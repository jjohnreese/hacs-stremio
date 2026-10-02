/** Shared, opt-in library and watch-status actions for the Cinema view. */
import { showTitleInfo } from './stremio-title-info-dialog.js?v=0.6.0';

export function managementItem(card, item) {
  return {
    media_id: card._extractMediaId ? card._extractMediaId(item) : (item.imdb_id || item.id),
    media_type: card._getItemMediaType ? card._getItemMediaType(item) : item.type,
    season: item.selectedSeason ?? item.season,
    episode: item.selectedEpisode ?? item.episode,
  };
}

export function libraryMembership(card, mediaId) {
  const libraryEntity = card.config.library_entity || (
    card.config.entity?.endsWith('_library_count') ? card.config.entity : null
  );
  const items = card._hass?.states?.[libraryEntity]?.attributes?.items;
  if (!Array.isArray(items)) return null;
  return items.some(item => item.id === mediaId || item.imdb_id === mediaId);
}

export async function manageTitle(card, item, action) {
  if (card._managementBusy) return;
  const selected = managementItem(card, item);
  if (!selected.media_id || !['movie', 'series'].includes(selected.media_type)) {
    card._showToast('Cannot identify this title', 'error');
    return;
  }
  if (['mark_watched', 'mark_unwatched'].includes(action)
      && selected.media_type === 'series'
      && (selected.season == null || selected.episode == null)) {
    card._showToast('Select the episode you want to mark');
    card._showEpisodePicker(item, 'detail');
    return;
  }
  const data = { media_id: selected.media_id, media_type: selected.media_type };
  const account = card.config.config_entry_id
    || card._hass?.entities?.[card.config.entity]?.config_entry_id
    || card._hass?.entities?.[card.config.library_entity]?.config_entry_id;
  if (account) data.config_entry_id = account;
  if (action === 'remove_from_library') delete data.media_type;
  if (['mark_watched', 'mark_unwatched'].includes(action) && selected.media_type === 'series') {
    data.season = selected.season;
    data.episode = selected.episode;
  }
  card._managementBusy = true;
  card._managementMessage = '';
  card.requestUpdate();
  try {
    await card._hass.callService('stremio', action, data);
    const messages = {
      mark_watched: 'Marked as watched', mark_unwatched: 'Marked as unwatched',
      clear_resume_progress: 'Resume progress cleared',
      add_to_library: 'Added to your library', remove_from_library: 'Removed from your library',
    };
    const episodeLabel = data.season != null ? ` · S${data.season}E${data.episode}` : '';
    card._managementMessage = `${messages[action]}${episodeLabel}`;
    card._managementMessageId = selected.media_id;
    card._showToast(card._managementMessage);
    // Keep the detail panel open after a title leaves Continue Watching.
    if (card._selectedItem && managementItem(card, card._selectedItem).media_id === selected.media_id
        && (action === 'clear_resume_progress' || ['mark_watched', 'mark_unwatched'].includes(action))) {
      const updated = { ...card._selectedItem };
      if (action === 'clear_resume_progress' || selected.media_type === 'movie'
          || (selected.season === item.season && selected.episode === item.episode)) {
        updated.progress = 0;
        updated.progress_percent = 0;
      }
      card._selectedItem = updated;
    }
  } catch (error) {
    card._managementMessage = error.message || 'Stremio update failed';
    card._managementMessageId = selected.media_id;
    card._showToast(card._managementMessage, 'error');
  } finally {
    card._managementBusy = false;
    card.requestUpdate();
  }
}

export function renderManagementActions(card, item, html) {
  if (!card.config.management_mode) return '';
  const selected = managementItem(card, item);
  const membership = libraryMembership(card, selected.media_id);
  const busy = Boolean(card._managementBusy);
  const known = membership !== null;
  const ready = Boolean(card._hass?.services?.stremio?.mark_watched);
  const disabled = busy || !ready || membership !== true;
  const isSeries = selected.media_type === 'series';
  const episodeReady = selected.season != null && selected.episode != null;
  const message = card._managementMessageId === selected.media_id ? card._managementMessage : '';
  return html`
    <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--divider-color)">
      <div class="detail-actions">
        <button class="detail-button secondary"
          @click=${() => {
            try { showTitleInfo(card._hass, selected, item.title || item.name); }
            catch (error) { card._showToast(error.message, 'error'); }
          }}>
          <ha-icon icon="mdi:information-outline"></ha-icon>Title Info
        </button>
      </div>
      <p class="detail-meta" style="margin-top:0">
        ${busy ? 'Saving to Stremio…' : isSeries && episodeReady
          ? `Manage episode S${selected.season}E${selected.episode}`
          : isSeries ? 'Select an episode to change its watched status' : 'Manage this movie'}
      </p>
      <div class="detail-actions" style="flex-wrap:wrap">
        <button class="detail-button primary" ?disabled=${disabled}
          @click=${() => manageTitle(card, item, 'mark_watched')}>
          <ha-icon icon="mdi:check-circle-outline"></ha-icon>Mark as watched
        </button>
        <button class="detail-button secondary" ?disabled=${disabled}
          @click=${() => manageTitle(card, item, 'mark_unwatched')}>
          <ha-icon icon="mdi:eye-off-outline"></ha-icon>Mark as unwatched
        </button>
      </div>
      <div class="detail-actions" style="flex-wrap:wrap">
        <button class="detail-button tertiary" ?disabled=${disabled}
          @click=${() => manageTitle(card, item, 'clear_resume_progress')}>
          <ha-icon icon="mdi:restart"></ha-icon>Clear resume progress
        </button>
        <button class="detail-button secondary" ?disabled=${busy || !known}
          @click=${() => manageTitle(card, item, membership ? 'remove_from_library' : 'add_to_library')}>
          <ha-icon icon="${membership ? 'mdi:playlist-remove' : 'mdi:playlist-plus'}"></ha-icon>
          ${membership ? 'Remove from library' : 'Add to library'}
        </button>
      </div>
      <p role="status" class="detail-meta">
        ${message || (!ready ? 'Watch-management services are loading.'
          : !known ? 'Waiting for library data.'
          : !membership ? 'Add this title to your library to manage watched status.' : '')}
      </p>
    </div>
  `;
}
