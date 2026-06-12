import { HOUR_PX, pxFromMinutes, formatKyivTime, kyivHourMinute } from './time.js';

export function renderDayTabs(host, festival, activeDayId, onChange) {
  host.innerHTML = '';
  for (const day of festival.days) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'daytab';
    btn.role = 'tab';
    btn.textContent = day.label;
    btn.dataset.dayId = day.id;
    btn.setAttribute('aria-selected', String(day.id === activeDayId));
    btn.addEventListener('click', () => onChange(day.id));
    host.appendChild(btn);
  }
}

export function renderGrid(host, festival, dayId, { onBlockClick, favorites }) {
  const day = festival.days.find((d) => d.id === dayId);
  if (!day) {
    host.innerHTML = '';
    return;
  }
  const hours = day.endHour - day.startHour;
  const bodyHeight = hours * HOUR_PX;
  const dayStages = resolveDayStages(festival, day);

  host.innerHTML = '';
  host.style.setProperty('--body-height', `${bodyHeight}px`);
  host.style.setProperty('--stage-count', String(dayStages.length));

  host.appendChild(buildCorner());
  for (const stage of dayStages) {
    host.appendChild(buildStageHeader(stage));
  }
  host.appendChild(buildTimeCol(day));

  const perfsByStage = groupBy(
    festival.performances.filter((p) => p.dayId === dayId),
    (p) => p.stageId,
  );
  for (const stage of dayStages) {
    host.appendChild(
      buildStageCol(stage, day, perfsByStage.get(stage.id) || [], onBlockClick, favorites),
    );
  }

  host.appendChild(buildNowLine());

  scheduleFit(host);
  ensureResizeFit(host);
}

const BLOCK_NAME_MAX_PX = 18;
const BLOCK_NAME_MIN_PX = 9;

function fitBlockText(host) {
  const blocks = host.querySelectorAll('.block');
  for (const block of blocks) {
    const name = block.querySelector('.block__name');
    if (!name) continue;
    name.style.fontSize = '';
    let fs = BLOCK_NAME_MAX_PX;
    while (fs > BLOCK_NAME_MIN_PX && block.scrollHeight > block.clientHeight + 1) {
      fs -= 1;
      name.style.fontSize = `${fs}px`;
    }
  }
}

let fitRaf = 0;
function scheduleFit(host) {
  cancelAnimationFrame(fitRaf);
  fitRaf = requestAnimationFrame(() => fitBlockText(host));
}

let resizeWired = false;
function ensureResizeFit(host) {
  if (resizeWired) return;
  resizeWired = true;
  window.addEventListener('resize', () => scheduleFit(host));
}

function resolveDayStages(festival, day) {
  const ids = Array.isArray(day.stages) && day.stages.length
    ? day.stages
    : festival.stages.map((s) => s.id);
  const byId = new Map(festival.stages.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function buildCorner() {
  const el = document.createElement('div');
  el.className = 'grid__corner';
  return el;
}

function buildStageHeader(stage) {
  const el = document.createElement('div');
  el.className = 'grid__stage-header';
  el.textContent = stage.name;
  el.dataset.stageId = stage.id;
  return el;
}

function buildTimeCol(day) {
  const col = document.createElement('div');
  col.className = 'grid__time-col';
  for (let h = day.startHour; h <= day.endHour; h++) {
    const tick = document.createElement('div');
    tick.className = 'time-tick';
    tick.style.top = `${(h - day.startHour) * HOUR_PX}px`;
    tick.textContent = `${String(h).padStart(2, '0')}:00`;
    col.appendChild(tick);
  }
  const pill = document.createElement('div');
  pill.className = 'now-time';
  pill.id = 'now-time';
  pill.hidden = true;
  col.appendChild(pill);
  return col;
}

function buildStageCol(stage, day, perfs, onBlockClick, favorites) {
  const col = document.createElement('div');
  col.className = 'grid__stage-col';
  col.dataset.stageId = stage.id;

  for (let h = day.startHour; h <= day.endHour; h++) {
    const line = document.createElement('div');
    line.className = 'hour-line';
    line.style.top = `${(h - day.startHour) * HOUR_PX}px`;
    col.appendChild(line);
  }

  for (const perf of perfs) {
    col.appendChild(buildBlock(perf, day, onBlockClick, favorites));
  }
  return col;
}

function buildBlock(perf, day, onBlockClick, favorites) {
  const start = new Date(perf.start);
  const end = new Date(perf.end);
  const dayStartMin = day.startHour * 60;

  const startMinFromMidnight = startMinutesInKyiv(start);
  const endMinFromMidnight = startMinutesInKyiv(end);

  const top = pxFromMinutes(startMinFromMidnight - dayStartMin);
  const height = Math.max(24, pxFromMinutes(endMinFromMidnight - startMinFromMidnight) - 1);

  const interactive = !perf.noDetails;
  const block = document.createElement(interactive ? 'button' : 'div');
  if (interactive) block.type = 'button';
  block.className = interactive ? 'block' : 'block block--info';
  if (interactive && favorites?.has(perf.id)) block.classList.add('block--starred');
  block.style.top = `${top}px`;
  block.style.height = `${height}px`;
  block.dataset.performanceId = perf.id;

  const head = document.createElement('div');
  head.className = 'block__head';
  const name = document.createElement('div');
  name.className = 'block__name';
  name.textContent = perf.artist;
  head.appendChild(name);
  if (interactive) {
    const palm = isPalmArtist(perf.artist);
    const star = document.createElement('span');
    star.className = palm ? 'block__star block__star--palm' : 'block__star';
    if (!palm) star.textContent = '★';
    star.setAttribute('aria-hidden', 'true');
    head.appendChild(star);
  }
  block.appendChild(head);

  const showCountry = perf.country && perf.country !== 'UA';
  if (perf.live || showCountry) {
    const tags = document.createElement('div');
    tags.className = 'block__tags';
    if (perf.live) {
      const live = document.createElement('span');
      live.className = 'block__tag block__tag--live';
      live.textContent = 'LIVE';
      tags.appendChild(live);
    }
    if (showCountry) {
      const country = document.createElement('span');
      country.className = 'block__tag block__tag--country';
      country.textContent = perf.country;
      tags.appendChild(country);
    }
    block.appendChild(tags);
  }

  const time = document.createElement('div');
  time.className = 'block__time';
  time.textContent = `${formatKyivTime(start)} – ${formatKyivTime(end)}`;
  block.appendChild(time);

  if (interactive) block.addEventListener('click', () => onBlockClick(perf));
  return block;
}

function startMinutesInKyiv(date) {
  const { hour, minute } = kyivHourMinute(date);
  return hour * 60 + minute;
}

function buildNowLine() {
  const line = document.createElement('div');
  line.className = 'now-line';
  line.id = 'now-line';
  line.hidden = true;
  return line;
}

export function isPalmArtist(name) {
  return typeof name === 'string' && name.trim().toLowerCase() === 'thongvor';
}


function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}
