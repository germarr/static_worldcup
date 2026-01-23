/**
 * World Cup 2026 Pool - Team Page Logic
 * Handles team viewing, joining, and leaderboard functionality
 */

(async function() {
  const WCP = window.WorldCupPool;

  // State
  let currentTeam = null;
  let currentTeamCode = null;
  let myMembership = null; // { displayName, token, isCreator }

  // DOM Elements
  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const noTeamState = document.getElementById('no-team-state');
  const teamContent = document.getElementById('team-content');
  const pageTitle = document.getElementById('page-title');
  const pageDescription = document.getElementById('page-description');
  const errorMessage = document.getElementById('error-message');

  // Team content elements
  const teamNameEl = document.getElementById('team-name');
  const memberCountEl = document.getElementById('member-count');
  const memberBadge = document.getElementById('member-badge');
  const creatorBadge = document.getElementById('creator-badge');
  const leaderboardEl = document.getElementById('leaderboard');
  const joinFormCard = document.getElementById('join-form-card');
  const updateBracketBtn = document.getElementById('update-bracket-btn');
  const leaveTeamBtn = document.getElementById('leave-team-btn');

  // Share modal elements
  const shareModal = document.getElementById('share-modal');
  const shareQrContainer = document.getElementById('share-qr-container');
  const teamCodeDisplay = document.getElementById('team-code-display');

  // Bracket modal elements
  const bracketModal = document.getElementById('bracket-modal');
  const bracketModalTitle = document.getElementById('bracket-modal-title');
  const bracketModalContent = document.getElementById('bracket-modal-content');
  const viewFullBracketBtn = document.getElementById('view-full-bracket-btn');

  // No team state elements
  const myTeamsSection = document.getElementById('my-teams-section');
  const myTeamsList = document.getElementById('my-teams-list');

  /**
   * Get team code from URL query parameter
   */
  function getTeamCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('c') || params.get('code');
  }

  /**
   * Show a specific state (loading, error, noTeam, content)
   */
  function showState(state) {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    noTeamState.classList.add('hidden');
    teamContent.classList.add('hidden');

    switch (state) {
      case 'loading':
        loadingState.classList.remove('hidden');
        break;
      case 'error':
        errorState.classList.remove('hidden');
        break;
      case 'noTeam':
        noTeamState.classList.remove('hidden');
        break;
      case 'content':
        teamContent.classList.remove('hidden');
        break;
    }
  }

  /**
   * Fetch team data from API
   */
  async function fetchTeam(code) {
    const response = await fetch(`${WCP.API_BASE_URL}/api/teams/${code}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Team not found');
      }
      throw new Error('Failed to fetch team');
    }
    return response.json();
  }

  /**
   * Join a team
   */
  async function joinTeam(code, displayName, bracketData) {
    const response = await fetch(`${WCP.API_BASE_URL}/api/teams/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, bracket_data: bracketData }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to join team');
    }
    return response.json();
  }

  /**
   * Update bracket for a member
   */
  async function updateBracket(code, displayName, bracketData, memberToken) {
    const response = await fetch(`${WCP.API_BASE_URL}/api/teams/${code}/members/${encodeURIComponent(displayName)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Member-Token': memberToken,
      },
      body: JSON.stringify({ bracket_data: bracketData }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update bracket');
    }
    return response.json();
  }

  /**
   * Leave a team
   */
  async function leaveTeam(code, displayName, memberToken) {
    const response = await fetch(`${WCP.API_BASE_URL}/api/teams/${code}/members/${encodeURIComponent(displayName)}`, {
      method: 'DELETE',
      headers: { 'X-Member-Token': memberToken },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to leave team');
    }
    return response.json();
  }

  /**
   * Check if current user is a member of the team
   */
  function checkMembership(team) {
    const memberToken = WCP.getTeamMemberToken(team.code);
    const creatorToken = WCP.getTeamCreatorToken(team.code);
    const myTeams = WCP.getMyTeams();
    const myTeam = myTeams.find(t => t.code === team.code);

    if (myTeam && memberToken) {
      return {
        displayName: myTeam.displayName,
        token: memberToken,
        isCreator: !!creatorToken,
      };
    }
    return null;
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 7) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMins > 0) {
      return `${diffMins}m ago`;
    } else {
      return 'Just now';
    }
  }

  /**
   * Calculate bracket score (placeholder - can be enhanced with actual scoring)
   */
  function calculateScore(bracketData) {
    // For now, return a placeholder score
    // In the future, this could compare against actual results
    return '-';
  }

  /**
   * Render the leaderboard
   */
  function renderLeaderboard(team) {
    leaderboardEl.innerHTML = '';

    if (!team.members || team.members.length === 0) {
      leaderboardEl.innerHTML = `
        <tr>
          <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">
            No members yet. Be the first to join!
          </td>
        </tr>
      `;
      return;
    }

    // Sort members by joined_at for now (can sort by score when results are available)
    const sortedMembers = [...team.members].sort((a, b) =>
      new Date(a.joined_at) - new Date(b.joined_at)
    );

    sortedMembers.forEach((member, index) => {
      const isCurrentUser = myMembership && member.display_name === myMembership.displayName;
      const row = document.createElement('tr');
      row.className = `cursor-pointer transition hover:bg-slate-50 ${isCurrentUser ? 'bg-emerald-50/50' : ''}`;
      row.innerHTML = `
        <td class="px-4 py-3 text-center font-semibold text-slate-400">${index + 1}</td>
        <td class="px-4 py-3">
          <span class="font-medium text-slate-900">${escapeHtml(member.display_name)}</span>
          ${isCurrentUser ? '<span class="ml-2 text-[10px] text-emerald-600">(You)</span>' : ''}
        </td>
        <td class="px-4 py-3 text-center font-mono text-slate-600">${calculateScore(member.bracket_data)}</td>
        <td class="px-4 py-3 text-right text-xs text-slate-400">${formatRelativeTime(member.updated_at)}</td>
      `;

      row.addEventListener('click', () => showBracketModal(member));
      leaderboardEl.appendChild(row);
    });
  }

  /**
   * Show bracket modal for a member
   */
  function showBracketModal(member) {
    bracketModalTitle.textContent = `${member.display_name}'s Bracket`;

    // Create preview of bracket stats
    bracketModalContent.innerHTML = `
      <div class="space-y-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm text-slate-600">
            <strong>Joined:</strong> ${new Date(member.joined_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
          <p class="mt-1 text-sm text-slate-600">
            <strong>Last Updated:</strong> ${new Date(member.updated_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
            })}
          </p>
        </div>
        <p class="text-sm text-slate-500">
          Click "View Full Bracket" to see all their predictions.
        </p>
      </div>
    `;

    // Set the link to view full bracket
    viewFullBracketBtn.href = `group-grid.html#p=${member.bracket_data}`;

    bracketModal.classList.remove('hidden');
    bracketModal.classList.add('flex');
  }

  /**
   * Hide bracket modal
   */
  function hideBracketModal() {
    bracketModal.classList.add('hidden');
    bracketModal.classList.remove('flex');
  }

  /**
   * Show share modal
   */
  function showShareModal() {
    if (!currentTeam) return;

    teamCodeDisplay.value = currentTeam.code;

    // Generate QR code
    shareQrContainer.innerHTML = '';
    const shareUrl = `${window.location.origin}${window.location.pathname}?c=${currentTeam.code}`;
    new QRCode(shareQrContainer, {
      text: shareUrl,
      width: 200,
      height: 200,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });

    shareModal.classList.remove('hidden');
    shareModal.classList.add('flex');
  }

  /**
   * Hide share modal
   */
  function hideShareModal() {
    shareModal.classList.add('hidden');
    shareModal.classList.remove('flex');
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 z-[60] rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all transform translate-y-0 ${
      type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Render the team page
   */
  function renderTeamPage(team) {
    currentTeam = team;

    // Update page title and description
    pageTitle.textContent = team.name;
    pageDescription.textContent = `Compete with ${team.members.length} member${team.members.length !== 1 ? 's' : ''} in this prediction pool.`;

    // Update team info
    teamNameEl.textContent = team.name;
    memberCountEl.textContent = team.members.length;

    // Check membership
    myMembership = checkMembership(team);

    if (myMembership) {
      memberBadge.classList.remove('hidden');
      updateBracketBtn.classList.remove('hidden');
      leaveTeamBtn.classList.remove('hidden');
      joinFormCard.classList.add('hidden');

      if (myMembership.isCreator) {
        creatorBadge.classList.remove('hidden');
      }
    } else {
      memberBadge.classList.add('hidden');
      creatorBadge.classList.add('hidden');
      updateBracketBtn.classList.add('hidden');
      leaveTeamBtn.classList.add('hidden');
      joinFormCard.classList.remove('hidden');
    }

    // Render leaderboard
    renderLeaderboard(team);

    showState('content');
  }

  /**
   * Render my teams list
   */
  function renderMyTeams() {
    const myTeams = WCP.getMyTeams();

    if (myTeams.length === 0) {
      myTeamsSection.classList.add('hidden');
      return;
    }

    myTeamsSection.classList.remove('hidden');
    myTeamsList.innerHTML = '';

    myTeams.forEach(team => {
      const row = document.createElement('a');
      row.href = `team.html?c=${team.code}`;
      row.className = 'flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 transition hover:border-emerald-300 hover:shadow-sm';
      row.innerHTML = `
        <div>
          <div class="font-medium text-slate-900">${escapeHtml(team.name)}</div>
          <div class="text-xs text-slate-500">As: ${escapeHtml(team.displayName)} ${team.isCreator ? '(Creator)' : ''}</div>
        </div>
        <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      `;
      myTeamsList.appendChild(row);
    });
  }

  /**
   * Initialize the page
   */
  async function init() {
    // Load shared data first
    await WCP.loadData();

    currentTeamCode = getTeamCodeFromUrl();

    if (!currentTeamCode) {
      // No team code - show join/create options
      pageTitle.textContent = 'Team Pools';
      pageDescription.textContent = 'Create or join a prediction pool to compete with friends.';
      renderMyTeams();
      showState('noTeam');
      return;
    }

    try {
      const team = await fetchTeam(currentTeamCode);
      renderTeamPage(team);
    } catch (error) {
      console.error('Failed to load team:', error);
      errorMessage.textContent = error.message || 'Failed to load team data.';
      showState('error');
    }
  }

  // Event Listeners

  // Share button
  document.getElementById('share-team-btn').addEventListener('click', showShareModal);
  document.getElementById('share-close-btn').addEventListener('click', hideShareModal);

  // Close modal on backdrop click
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) hideShareModal();
  });

  // Copy code button
  document.getElementById('copy-code-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(teamCodeDisplay.value);
    showToast('Team code copied!');
  });

  // Copy URL button
  document.getElementById('share-copy-url-btn').addEventListener('click', () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?c=${currentTeam.code}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('Link copied!');
  });

  // Download QR button
  document.getElementById('share-download-btn').addEventListener('click', () => {
    const canvas = shareQrContainer.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `team-${currentTeam.code}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('QR code downloaded!');
    }
  });

  // Bracket modal close
  document.getElementById('bracket-close-btn').addEventListener('click', hideBracketModal);
  bracketModal.addEventListener('click', (e) => {
    if (e.target === bracketModal) hideBracketModal();
  });

  // Join form submit
  document.getElementById('join-submit-btn').addEventListener('click', async () => {
    const displayName = document.getElementById('join-display-name').value.trim();

    if (!displayName) {
      showToast('Please enter a display name', 'error');
      return;
    }

    if (displayName.length > 30) {
      showToast('Display name must be 30 characters or less', 'error');
      return;
    }

    try {
      const bracketData = await WCP.getCurrentBracketData();

      if (!bracketData || bracketData.length < 10) {
        showToast('Please make some bracket picks before joining', 'error');
        return;
      }

      const result = await joinTeam(currentTeamCode, displayName, bracketData);

      // Save token and update local storage
      WCP.setTeamMemberToken(result.team_code, result.member_token);
      WCP.addToMyTeams(result.team_code, result.team_name, displayName);

      showToast('Successfully joined the team!');

      // Reload team data
      const team = await fetchTeam(currentTeamCode);
      renderTeamPage(team);
    } catch (error) {
      console.error('Failed to join team:', error);
      showToast(error.message || 'Failed to join team', 'error');
    }
  });

  // Update bracket button
  updateBracketBtn.addEventListener('click', async () => {
    if (!myMembership) return;

    try {
      const bracketData = await WCP.getCurrentBracketData();
      await updateBracket(currentTeamCode, myMembership.displayName, bracketData, myMembership.token);
      showToast('Bracket updated!');

      // Reload team data
      const team = await fetchTeam(currentTeamCode);
      renderTeamPage(team);
    } catch (error) {
      console.error('Failed to update bracket:', error);
      showToast(error.message || 'Failed to update bracket', 'error');
    }
  });

  // Leave team button
  leaveTeamBtn.addEventListener('click', async () => {
    if (!myMembership) return;

    if (!confirm('Are you sure you want to leave this team?')) return;

    try {
      await leaveTeam(currentTeamCode, myMembership.displayName, myMembership.token);
      WCP.removeFromMyTeams(currentTeamCode);
      showToast('Left the team');

      // Reload team data
      const team = await fetchTeam(currentTeamCode);
      renderTeamPage(team);
    } catch (error) {
      console.error('Failed to leave team:', error);
      showToast(error.message || 'Failed to leave team', 'error');
    }
  });

  // Join code button (no-team state)
  document.getElementById('join-code-btn').addEventListener('click', () => {
    const code = document.getElementById('join-code-input').value.trim();
    if (code) {
      window.location.href = `team.html?c=${code}`;
    }
  });

  // Initialize
  init();
})();
