import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LANGUAGE_KEY, setInterfaceLanguage, tr, translateLabel, useInterfaceLanguage } from './i18n';
import { useState } from 'react';

afterEach(()=>{cleanup();setInterfaceLanguage('en');});
describe('interface language',()=>{
  it('translates placeholders and status labels without changing unknown text',()=>{
    setInterfaceLanguage('vi');
    expect(tr('  Save changes ')).toBe('  Lưu thay đổi ');
    expect(tr('Audit cycle {p0} of 3 · Every issue requires concrete evidence.',{p0:2})).toContain('2/3');
    expect(translateLabel('HUMAN_REVIEW')).toBe('Cần duyệt thủ công');
    expect(tr('An untouched original narration.')).toBe('An untouched original narration.');
    expect(tr('')).toBe('');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
    setInterfaceLanguage('en');
    expect(tr('Save changes')).toBe('Save changes');
  });
  it('keeps in-progress inputs and canonical select values when switching languages',()=>{
    function Form(){
      useInterfaceLanguage();const [text,setText]=useState('Original English draft'),[mode,setMode]=useState('Custom');
      return <><input aria-label="draft" value={text} onChange={e=>setText(e.target.value)}/><select aria-label="mode" value={mode} onChange={e=>setMode(e.target.value)}>{['Auto','Custom'].map(v=><option key={v} value={v}>{tr(v)}</option>)}</select><button onClick={()=>setInterfaceLanguage('vi')}>VI</button><button onClick={()=>setInterfaceLanguage('en')}>EN</button></>;
    }
    render(<Form/>);fireEvent.change(screen.getByLabelText('draft'),{target:{value:'Unsaved text'}});
    fireEvent.click(screen.getByText('VI'));
    expect(screen.getByLabelText('draft')).toHaveValue('Unsaved text');
    expect(screen.getByLabelText('mode')).toHaveValue('Custom');
    expect(screen.getByRole('option',{name:'Tùy chỉnh'})).toBeInTheDocument();
    fireEvent.click(screen.getByText('EN'));
    expect(screen.getByLabelText('mode')).toHaveValue('Custom');
    expect(screen.getByLabelText('draft')).toHaveValue('Unsaved text');
  });
});
