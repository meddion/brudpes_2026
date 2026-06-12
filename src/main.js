import { ACTIVE_FESTIVAL } from './config.js';
import { loadFestival } from './data.js';
import { renderDayTabs, renderGrid } from './render.js';
import { startNowLoop } from './now.js';
import { setupDetails } from './details.js';
import { createFavorites } from './favorites.js';
import { nowInstant, dayStartInstant, dayEndInstant } from './time.js';

const els = {
  daytabs: document.getElementById('daytabs'),
  grid: document.getElementById('schedule-grid'),
  viewport: document.getElementById('schedule-viewport'),
  error: document.getElementById('schedule-error'),
  chip: document.getElementById('now-chip'),
  dialog: document.getElementById('details'),
  detailsArtist: document.getElementById('details-artist'),
  detailsStage: document.getElementById('details-stage'),
  detailsTime: document.getElementById('details-time'),
  detailsCountryRow: document.getElementById('details-country-row'),
  detailsCountry: document.getElementById('details-country'),
  detailsLiveRow: document.getElementById('details-live-row'),
  detailsStarBtn: document.getElementById('details-star'),
  detailsStarLabel: document.getElementById('details-star-label'),
};

boot().catch((err) => {
  console.error(err);
  els.error.textContent = err.message || String(err);
  els.error.hidden = false;
});

async function boot() {
  const festival = await loadFestival(ACTIVE_FESTIVAL);
  document.title = `${festival.name} — Schedule`;

  const favorites = createFavorites(festival.id);
  favorites.onChange((perfId, on) => {
    const block = document.querySelector(`[data-performance-id="${perfId}"]`);
    if (block) block.classList.toggle('block--starred', on);
  });

  let activeDayId = pickInitialDay(festival);
  const details = setupDetails({
    dialog: els.dialog,
    artistEl: els.detailsArtist,
    stageEl: els.detailsStage,
    timeEl: els.detailsTime,
    countryRow: els.detailsCountryRow,
    countryEl: els.detailsCountry,
    liveRow: els.detailsLiveRow,
    starBtn: els.detailsStarBtn,
    starLabel: els.detailsStarLabel,
    festival,
    favorites,
  });

  const onBlockClick = (perf) => details.open(perf);
  let nowLoop;
  const setActiveDay = (id) => {
    activeDayId = id;
    document.documentElement.dataset.day = id;
    renderDayTabs(els.daytabs, festival, activeDayId, setActiveDay);
    renderGrid(els.grid, festival, activeDayId, { onBlockClick, favorites });
    nowLoop?.refresh();
  };

  document.documentElement.dataset.day = activeDayId;
  renderDayTabs(els.daytabs, festival, activeDayId, setActiveDay);
  renderGrid(els.grid, festival, activeDayId, { onBlockClick, favorites });

  nowLoop = startNowLoop({
    festival,
    getActiveDay: () => festival.days.find((d) => d.id === activeDayId),
    viewport: els.viewport,
    chip: els.chip,
  });
}

function pickInitialDay(festival) {
  const now = nowInstant();
  for (const day of festival.days) {
    if (now >= dayStartInstant(festival, day) && now <= dayEndInstant(festival, day)) {
      return day.id;
    }
  }
  for (const day of festival.days) {
    if (now < dayStartInstant(festival, day)) return day.id;
  }
  return festival.days[0].id;
}
