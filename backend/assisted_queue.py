"""Durable, opt-in project queue. Finished media never authorizes a render."""
import logging
from threading import RLock
from sqlalchemy import text as sql_text
from .models import Channel, Chunk, Job, Project, now, serialize
from .narration import setup_pending, setup_checkpoint


class AssistedQueue:
    def __init__(self, workflow):
        self.workflow = workflow
        self.lock = RLock()
        self.dispatching = False

    @staticmethod
    def enroll(project, status='running'):
        if setup_pending(project):return
        prior = project.settings.get('assisted_queue', {})
        project.settings = {**project.settings, 'assisted_queue': {
            'requested_at': prior.get('requested_at') or now(), 'status': status}}

    def production_checkpoint(self, db, project, config):
        if not project.locked:
            return 'waiting_user'
        from .resource_review import state
        return 'ready_to_render' if state(db, project, self.workflow.root, config)['ready'] else 'resources_pending'

    def request(self, project_id):
        from .workflow import settings_for
        with self.workflow.deletion_lock, self.workflow.database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            project = db.get(Project, project_id)
            if not project or settings_for(db, db.get(Channel, project.channel_id))['pipeline_mode'] != 'assisted':
                raise ValueError('Choose Assisted mode before queueing this project')
            if setup_pending(project):return setup_checkpoint()
            active = db.query(Job).filter(Job.project_id == project_id, Job.status.in_(('queued', 'running', 'waiting_user'))).first()
            if active:
                self.enroll(project)
                db.commit()
                return serialize(active)
            self.enroll(project, 'queued')
            db.commit()
        self.tick()
        with self.workflow.database.session() as db:
            project = db.get(Project, project_id)
            active = db.query(Job).filter(Job.project_id == project_id, Job.status.in_(('queued', 'running', 'waiting_user'))).first()
            if active:
                return serialize(active)
            queued = project.settings.get('assisted_queue', {}).get('status') == 'queued'
            return {'project_id': project_id, 'status': 'queued' if queued else 'waiting_user',
                    **({'message': 'Project queued. It will start after the current project finishes resource generation.'}
                       if queued else self.workflow.next_step(db, project))}

    def tick(self):
        from .workflow import settings_for, auto_lock_story
        with self.lock:
            if self.dispatching:
                return
            self.dispatching = True
        try:
            # A pass can release several projects at human checkpoints, but
            # launches at most one next project. Unrequested projects stay idle.
            with self.workflow.database.session() as db:
                projects = [p for p in db.query(Project)
                            if p.settings.get('assisted_queue', {}).get('status') in ('queued', 'running')]
                projects.sort(key=lambda p: (p.settings['assisted_queue']['status'] != 'running',
                                             p.settings['assisted_queue']['requested_at'], p.id))
                ids = [p.id for p in projects]
            for project_id in ids:
                with self.workflow.database.session() as db:
                    project = db.get(Project, project_id)
                    if not project:
                        continue
                    config = settings_for(db, db.get(Channel, project.channel_id))
                    if config['pipeline_mode'] != 'assisted':
                        continue
                    status = project.settings.get('assisted_queue', {}).get('status')
                    busy = db.query(Job).filter(Job.project_id == project_id,
                                                Job.status.in_(('queued', 'running', 'waiting_user'))).count()
                    if status == 'running' and busy:
                        return
                if status == 'running':
                    self.workflow.drain_production_queue(project_id)
                    with self.workflow.deletion_lock, self.workflow.database.session() as db:
                        db.execute(sql_text('BEGIN IMMEDIATE'))
                        if db.query(Job).filter(Job.project_id == project_id,
                                               Job.status.in_(('queued', 'running', 'waiting_user'))).count():
                            return
                        project = db.get(Project, project_id)
                        action = self.workflow.next_step(db, project)
                        # A failed text job waits for repair instead of being
                        # silently retried by the project scheduler.
                        last = db.query(Job).filter_by(project_id=project_id).order_by(Job.created_at.desc()).first()
                        if 'kind' in action and last and last.status in ('failed', 'cancelled'):
                            self.enroll(project, 'waiting_user')
                            db.commit()
                            continue
                else:
                    # Check all running projects, not just their creation order.
                    with self.workflow.database.session() as db:
                        if any(p.settings.get('assisted_queue', {}).get('status') == 'running'
                               and db.query(Job).filter(Job.project_id == p.id,
                                                       Job.status.in_(('queued', 'running', 'waiting_user'))).count()
                               for p in db.query(Project)):
                            return
                with self.workflow.deletion_lock, self.workflow.database.session() as db:
                    db.execute(sql_text('BEGIN IMMEDIATE'))
                    project = db.get(Project, project_id)
                    if not project:
                        continue
                    if db.query(Job).filter(Job.project_id == project_id,
                                            Job.status.in_(('queued', 'running', 'waiting_user'))).count():
                        return
                    self.workflow.auto_choose_premise(db, project, config)
                    action = self.workflow.next_step(db, project)
                    if 'gate' in action and auto_lock_story(db, project):
                        action = self.workflow.next_step(db, project)
                    if (project.locked and config['provider_mode']=='browser'
                            and not project.settings.get('auto_production', {}).get('tts_started')
                            and db.query(Chunk).filter_by(project_id=project_id).count()
                            and action.get('action_kind') != 'render'
                            and action.get('kind') != 'chunk_tts'):
                        action = {'media':'tts'}
                    if not ('kind' in action or 'media' in action) or action.get('kind') in ('sync', 'render'):
                        self.enroll(project, self.production_checkpoint(db, project, config))
                        db.commit()
                        continue
                    self.enroll(project)
                    db.commit()
                try:
                    if action.get('media'):
                        self.workflow.media_automation.start(project_id, {'kind':action['media']})
                    else:
                        self.workflow.submit(action['kind'], project_id=project_id,
                                             payload={**action.get('payload', {}), 'auto_continue': True})
                except ValueError as exc:
                    with self.workflow.database.session() as db:
                        project = db.get(Project, project_id)
                        self.enroll(project, 'waiting_user')
                        project.settings = {**project.settings, 'production_queue_notice': str(exc)}
                        db.commit()
                return
        except Exception:
            logging.getLogger('app').exception('Assisted project queue failed')
        finally:
            with self.lock:
                self.dispatching = False
