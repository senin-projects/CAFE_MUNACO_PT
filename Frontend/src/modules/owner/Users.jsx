import { useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../auth.jsx'
import { useFetch } from '../../hooks.js'
import { ErrorBox, Loading, Modal, PageHeader } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { ROLE_LABEL, dateOnly } from '../../utils.js'

const BLANK = { full_name: '', username: '', role: 'cashier', password: '' }

// [WBS 4.4.1] Implement staff account create, update, and activate or deactivate.
// [WBS 4.4.2] Implement staff password reset.
export default function Users() {
  const { user: me } = useAuth()
  const { data, error, loading, reload } = useFetch('/users')
  const [modal, setModal] = useState(null) // { mode: 'add' | 'edit' | 'password', user? }
  const [form, setForm] = useState(BLANK)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [confirmUser, setConfirmUser] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

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
    setActionBusy(true)
    try {
      await api(`/users/${u.id}/active`, { method: 'PATCH', body: { is_active: !u.is_active } })
      setConfirmUser(null)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionBusy(false)
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
          <table className="users-table">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th className="users-actions-heading" aria-label="Actions"></th></tr></thead>
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
                        onClick={() => {
                          setActionError('')
                          setConfirmUser(u)
                        }}
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
      {confirmUser && (
        <Modal
          title="Confirm account change"
          eyebrow="USER MANAGEMENT"
          className="user-action-modal"
          showCloseButton
          onClose={() => {
            if (!actionBusy) {
              setConfirmUser(null)
              setActionError('')
            }
          }}
        >
          <ErrorBox message={actionError} />
          <div className="user-confirm-panel">
            <div className={`user-confirm-icon ${confirmUser.is_active ? 'is-deactivating' : 'is-reactivating'}`}>
              <Icon name={confirmUser.is_active ? 'userX' : 'userCheck'} size={21} />
            </div>
            <div className="user-confirm-copy">
              <div className="user-confirm-employee">
                <strong>{confirmUser.full_name}</strong>
                <span className={`badge ${confirmUser.is_active ? 'stock-ok' : 'badge-cancelled'}`}>
                  {confirmUser.is_active ? 'Active' : 'Deactivated'}
                </span>
              </div>
              <p>{confirmUser.is_active
                ? 'This employee will be signed out and lose access until reactivated.'
                : 'This employee will regain access and be able to sign in again.'}</p>
            </div>
          </div>
          <div className="user-confirm-actions">
            <button type="button" className="btn" disabled={actionBusy} onClick={() => setConfirmUser(null)}>Cancel</button>
            <button
              type="button"
              className={`btn ${confirmUser.is_active ? 'btn-danger' : 'btn-primary'}`}
              disabled={actionBusy}
              onClick={() => toggle(confirmUser)}
            >
              {actionBusy ? 'Updating...' : confirmUser.is_active ? 'Deactivate account' : 'Reactivate account'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
