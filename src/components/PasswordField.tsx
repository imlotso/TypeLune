import { useId, useState, type ComponentPropsWithoutRef } from 'react';
import { Eye } from '@phosphor-icons/react/Eye';
import { EyeSlash } from '@phosphor-icons/react/EyeSlash';

type Props = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & { label: string; toggleLabel?: string };

export function PasswordField({ label, toggleLabel = '密码', ...input }: Props) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const id = input.id ?? generatedId;
  return <div className="password-control"><label htmlFor={id}>{label}</label><span className="password-field">
    <input {...input} id={id} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-toggle" aria-label={`${visible ? '隐藏' : '显示'}${toggleLabel}`}
      aria-pressed={visible} onMouseDown={(event) => event.preventDefault()} onClick={() => setVisible((current) => !current)}>
      {visible ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </button>
  </span></div>;
}
