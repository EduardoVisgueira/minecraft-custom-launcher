import { useState } from 'react'
import metalPlate02Tex from '../../assets/textures/metal_plate_02.jpg'
import skullCrackIcon from '../../assets/game-icons/lorc_skull-crack.svg'
import './AccountSelector.css'

export default function AccountSelector({ account, onLogout, onAccountChange, compact = false }) {
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
    <div className={`account-selector${compact ? ' account-selector--compact' : ''}`}>
      <button className="account-btn" onClick={open ? () => setOpen(false) : loadAccounts}>
        <div className="account-avatar">
          {account.username.charAt(0).toUpperCase()}
        </div>
        {!compact && (
          <div className="account-info">
            <span className="account-name">{account.username}</span>
            <span className="account-type">
              {account.type === 'microsoft' ? 'Premium' : 'Offline'}
            </span>
          </div>
        )}
        {compact && <span className="account-name account-name--compact">{account.username}</span>}
      </button>

      {open && accounts && (
        <div className="account-dropdown">
          {/* Chapa metálica: textura real */}
          <span className="panel-tex" style={{ backgroundImage: `url(${metalPlate02Tex})` }} aria-hidden="true" />
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
            <span className="mask-ic dropdown-logout-ic" style={{ '--icon': `url(${skullCrackIcon})` }} aria-hidden="true" />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
