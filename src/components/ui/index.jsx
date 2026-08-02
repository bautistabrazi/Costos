import { LoaderCircle,X } from 'lucide-react'
import { cx } from '../../utils/format'
export const Button=({className='',variant='primary',loading,children,...props})=><button className={cx('button',`button--${variant}`,className)} disabled={loading||props.disabled} {...props}>{loading&&<LoaderCircle size={16} className="spin"/>}{children}</button>
export const Card=({className='',children,...props})=><section className={cx('card',className)} {...props}>{children}</section>
export const Field=({label,error,children,hint})=><label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}{error&&<small className="error">{error}</small>}</label>
export const EmptyState=({icon:Icon,title,text,action})=><div className="empty">{Icon&&<Icon size={30}/>}<strong>{title}</strong><p>{text}</p>{action}</div>
export const Badge=({children,tone='neutral'})=><span className={`badge badge--${tone}`}>{children}</span>
export function Modal({open,onClose,title,children}){if(!open)return null;return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X/></button></header>{children}</div></div>}
export const PageHeader=({eyebrow,title,description,action})=><header className="page-header"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</header>
