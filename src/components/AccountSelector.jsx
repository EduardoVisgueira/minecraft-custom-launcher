import { useState } from 'react'
import './AccountSelector.css'

export default function AccountSelector({ account, onLogout, onAccountChange }) {
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState(null)

  async function loadAccounts() {
    const data = await window.electronAPI.getAccounts()
    setAccounts(data.accounts)
    setOpen(true)
  }

  async function switchAccount(acc) {
    await window.electronAPI.setActiveAccount(acc.uuid)
    onAccountChange(acc)
    setOpen(false)
  }

  async function removeAccount(uuid) {
    await window.electronAPI.removeAccount(uuid)
    if (uuid === account.uuid) {
      onLogout()
    } else {
      const data = await window.electronAPI.getAccounts()
      setAccounts(data.accounts)
    }
  }

  return (
    <div className="account-selector">
      <button className="account-btn" onClick={open ? () => setOpen(false) : loadAccounts}>
        <div className="account-avatar">
          {account.username.charAt(0).toUpperCase()}
        </div>
        <div className="account-info">
          <span className="account-name">{account.username}</span>
          <span className="account-type">
            {account.type === 'microsoft' ? 'Premium' : 'Offline'}
          </span>
        </div>
      </button>

      {open && accounts && (
        <div className="account-dropdown">
          <div className="dropdown-header">Contas</div>
          {accounts.map(acc => (
            <div
              key={acc.uuid}
              className={`dropdown-item ${acc.uuid === account.uuid ? 'active' : ''}`}
            >
              <button className="item-switch" onClick={() => switchAccount(acc)}>
                <div className="item-avatar">{acc.username.charAt(0).toUpperCase()}</div>
                <div className="item-info">
                  <span>{acc.username}</span>
                  <span className="item-type">{acc.type === 'microsoft' ? 'Premium' : 'Offline'}</span>
                </div>
              </button>
              {acc.uuid !== account.uuid && (
                <button
                  className="item-remove"
                  onClick={() => removeAccount(acc.uuid)}
                  title="Remover conta"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="dropdown-divider" />
          <button className="dropdown-logout" onClick={onLogout}>
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
