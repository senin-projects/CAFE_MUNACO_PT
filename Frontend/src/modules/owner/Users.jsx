import { useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../auth.jsx'
import { useFetch } from '../../hooks.js'
import { ErrorBox, Loading, Modal, PageHeader } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { ROLE_LABEL, dateOnly } from '../../utils.js'

const BLANK = { full_name: '', username: '', role: 'cashier', password: '' }

export default function Users() {
  const { user: me } = useAuth()
  const { data, error, loading, reload } = useFetch('/users')
  const [modal, setModal] = useState(null) // { mode: 'add' | 'edit' | 'password', user? }
  const [form, setForm] = useState(BLANK)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value })
  const open = (mode, user) => {
    setForm(user ? { ...BLANK, full_name: user.full_name, role: user.role } : BLANK)
    setFormError('')
    setModal({ mode, user })
  }

  async function save(e) {
    e.preventDefault()
    setFormError('')
    try {
      if (modal.mode === 'add') await api('/users', { method: 'POST', body: form })
      if (modal.mode === 'edit') await api(`/users/${modal.user.id}`, { method: 'PUT', body: form })
      if (modal.mode === 'password') await api(`/users/${modal.user.id}/reset-password`, { method: 'POST', body: { password: form.password } })
      setModal(null)
      reload()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function toggle(u) {
    setActionError('')
    const verb = u.is_active ? 'Deactivate' : 'Reactivate'
    if (!window.confirm(`${verb} ${u.full_name}?${u.is_active ? ' They will be signed out and cannot sign in again.' : ''}`)) return
    try {
      await api(`/users/${u.id}/active`, { method: 'PATCH', body: { is_active: !u.is_active } })
      reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <>
      <PageHeader title="User Management" subtitle="Create, edit and deactivate employee accounts.">
        <button className="btn btn-primary" onClick={() => open('add')}>Add employee</button>
      </PageHeader>
      <ErrorBox message={error || actionError} />

      {loading && !data ? <Loading /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'inactive'}>
                  <td><strong>{u.full_name}</strong>{u.id === me.id && <span className="tag">You</span>}</td>
                  <td>{u.username}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td><span className={`badge ${u.is_active ? 'stock-ok' : 'badge-cancelled'}`}>{u.is_active ? 'Active' : 'Deactivated'}</span></td>
                  <td className="muted">{dateOnly(u.created_at)}</td>
                  <td className="user-row-actions">
                    <button className="icon-button" onClick={() => open('edit', u)} aria-label={`Edit ${u.full_name}`} title="Edit">
                      <Icon name="edit" size={17} />
                    </button>
                    {u.id !== me.id && (
                      <button
                        className={`icon-button ${u.is_active ? 'icon-button-danger' : ''}`}
                        onClick={() => toggle(u)}
                        aria-label={`${u.is_active ? 'Deactivate' : 'Reactivate'} ${u.full_name}`}
                        title={u.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        <Icon name={u.is_active ? 'userX' : 'userCheck'} size={17} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add employee' : modal.mode === 'edit' ? `Edit ${modal.user.full_name}` : `New password for ${modal.user.full_name}`}
          onClose={() => setModal(null)}
        >
          <form className="form" onSubmit={save}>
            <ErrorBox message={formError} />
            {modal.mode !== 'password' && <label>Full name<input value={form.full_name} onChange={set('full_name')} autoFocus /></label>}
            {modal.mode === 'add' && <label>Username<input value={form.username} onChange={set('username')} autoComplete="off" /></label>}
            {modal.mode !== 'password' && (
              <label>Role
                <select value={form.role} onChange={set('role')} disabled={modal.mode === 'edit' && modal.user.id === me.id}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            )}
            {modal.mode !== 'edit' && <label>{modal.mode === 'add' ? 'Password' : 'New password'}<input type="text" value={form.password} onChange={set('password')} autoComplete="off" /></label>}
            <div className="form-actions">
              <button className="btn btn-primary">{modal.mode === 'add' ? 'Add employee' : 'Save'}</button>
              {modal.mode === 'edit' && <button type="button" className="btn" onClick={() => open('password', modal.user)}>Reset password</button>}
              <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
