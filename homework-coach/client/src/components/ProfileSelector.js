import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Settings, LogOut, User, Edit2, Trash2, Check, X } from 'lucide-react';

const AVATARS = [
  { id: 'astronaut', emoji: '🧑‍🚀' },
  { id: 'scientist', emoji: '🧑‍🔬' },
  { id: 'artist', emoji: '🧑‍🎨' },
  { id: 'student', emoji: '🧑‍🎓' },
  { id: 'wizard', emoji: '🧙' },
  { id: 'superhero', emoji: '🦸' },
  { id: 'robot', emoji: '🤖' },
  { id: 'alien', emoji: '👽' },
  { id: 'cat', emoji: '🐱' },
  { id: 'dog', emoji: '🐶' },
  { id: 'unicorn', emoji: '🦄' },
  { id: 'dragon', emoji: '🐲' },
];

function getAvatarEmoji(avatarId) {
  const avatar = AVATARS.find(a => a.id === avatarId);
  return avatar ? avatar.emoji : '👤';
}

function ProfileSelector() {
  const { family, children, selectChild, addChild, updateChild, deleteChild, logout } = useAuth();
  const [showAddChild, setShowAddChild] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingChild, setEditingChild] = useState(null);

  // Add child form state
  const [newName, setNewName] = useState('');
  const [newYear, setNewYear] = useState(7);
  const [newAvatar, setNewAvatar] = useState('student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddChild = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await addChild(newName, newYear, newAvatar);
      setNewName('');
      setNewYear(7);
      setNewAvatar('student');
      setShowAddChild(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateChild = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await updateChild(editingChild.id, {
        name: newName,
        yearGroup: newYear,
        avatar: newAvatar,
      });
      setEditingChild(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChild = async (childId) => {
    if (!window.confirm('Are you sure you want to delete this profile? All progress will be lost.')) {
      return;
    }

    try {
      await deleteChild(childId);
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditing = (child) => {
    setNewName(child.name);
    setNewYear(child.year_group);
    setNewAvatar(child.avatar || 'student');
    setEditingChild(child);
    setShowAddChild(false);
  };

  const cancelEditing = () => {
    setEditingChild(null);
    setNewName('');
    setNewYear(7);
    setNewAvatar('student');
    setError('');
  };

  return (
    <div className="profile-selector">
      <div className="profile-header">
        <h1>Who's studying today?</h1>
        <p>{family?.familyName || 'Your Family'}</p>
        <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
          <Settings size={20} />
        </button>
      </div>

      {showSettings && (
        <div className="settings-dropdown">
          <button onClick={logout} className="logout-btn">
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      )}

      {error && <div className="profile-error">{error}</div>}

      <div className="profiles-grid">
        {children.map(child => (
          <div key={child.id} className="profile-card-wrapper">
            {editingChild?.id === child.id ? (
              <form onSubmit={handleUpdateChild} className="profile-edit-form">
                <div className="avatar-selector">
                  {AVATARS.slice(0, 6).map(avatar => (
                    <button
                      key={avatar.id}
                      type="button"
                      className={`avatar-option ${newAvatar === avatar.id ? 'selected' : ''}`}
                      onClick={() => setNewAvatar(avatar.id)}
                    >
                      {avatar.emoji}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  required
                />
                <select value={newYear} onChange={(e) => setNewYear(parseInt(e.target.value))}>
                  {[7, 8, 9, 10, 11].map(y => (
                    <option key={y} value={y}>Year {y}</option>
                  ))}
                </select>
                <div className="edit-actions">
                  <button type="submit" className="save-btn" disabled={isLoading}>
                    <Check size={16} />
                  </button>
                  <button type="button" className="cancel-btn" onClick={cancelEditing}>
                    <X size={16} />
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="profile-card"
                onClick={() => selectChild(child)}
              >
                <div className="profile-avatar">
                  {getAvatarEmoji(child.avatar)}
                </div>
                <div className="profile-name">{child.name}</div>
                <div className="profile-year">Year {child.year_group}</div>
              </button>
            )}
            {!editingChild && (
              <div className="profile-actions">
                <button onClick={() => startEditing(child)} title="Edit">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDeleteChild(child.id)} title="Delete" className="delete-btn">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}

        {showAddChild ? (
          <form onSubmit={handleAddChild} className="add-child-form">
            <div className="avatar-selector">
              {AVATARS.slice(0, 6).map(avatar => (
                <button
                  key={avatar.id}
                  type="button"
                  className={`avatar-option ${newAvatar === avatar.id ? 'selected' : ''}`}
                  onClick={() => setNewAvatar(avatar.id)}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Child's name"
              required
              autoFocus
            />
            <select value={newYear} onChange={(e) => setNewYear(parseInt(e.target.value))}>
              {[7, 8, 9, 10, 11].map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
            <div className="form-actions">
              <button type="submit" className="save-btn" disabled={isLoading}>
                {isLoading ? '...' : 'Add'}
              </button>
              <button type="button" className="cancel-btn" onClick={() => setShowAddChild(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            className="add-profile-card"
            onClick={() => {
              setShowAddChild(true);
              setEditingChild(null);
            }}
          >
            <div className="add-icon">
              <Plus size={32} />
            </div>
            <div className="add-text">Add Child</div>
          </button>
        )}
      </div>

      <div className="profile-tip">
        <User size={16} />
        <span>Each child gets their own progress tracking and quiz history</span>
      </div>
    </div>
  );
}

export default ProfileSelector;
