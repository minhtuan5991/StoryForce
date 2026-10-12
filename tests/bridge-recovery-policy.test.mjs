import {test} from 'node:test';
import assert from 'node:assert/strict';
import {responseObstacle} from '../browser-extension/response-recovery.js';

test('only short direct quota/login notices are classified as provider obstacles',()=>{
  for(const text of ["You've hit the message limit",'You’ve reached your usage limit','Too many requests',
    'Sign in to continue','Bạn đã đạt giới hạn sử dụng'])assert.equal(responseObstacle(text),true,text);
  for(const text of ['Write a shorter answer','The JSON is complete.',
    '{"text":"Too many requests came over the radio."}', 'The caller said: Sign in to continue.',
    'Sign in to continue '+ 'story '.repeat(500)])assert.equal(responseObstacle(text),false,text);
});
