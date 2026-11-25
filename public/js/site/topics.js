import { formula, h } from '../shared/utils.js';
import { TOPICS } from './content.js';
import { moleculeSvg } from './molecules.js';

const section = document.getElementById('topics');
const tabList = document.getElementById('topic-tabs');
const panel = document.getElementById('topic-panel');

function renderPanel(topic) {
  const figure = h('figure', { class: 'figure' });
  figure.innerHTML = moleculeSvg(topic.molecule, topic.caption[0]); // static markup only
  figure.append(h('figcaption', {}, h('b', {}, topic.caption[0]), topic.caption[1]));
  panel.replaceChildren(
    h('div', { class: 'topic-text' },
      h('h3', {}, topic.heading),
      h('p', {}, topic.text),
      h('ul', { class: 'substances' }, topic.substances.map(([code, name, use]) =>
        h('li', {}, h('span', { class: 'formula' }, formula(code)), h('div', {}, h('b', {}, name), use))))),
    figure,
  );
  panel.setAttribute('aria-labelledby', `tab-${topic.id}`);
}

function select(index, focus = false) {
  [...tabList.children].forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
  });
  section.dataset.topic = TOPICS[index].id;
  renderPanel(TOPICS[index]);
  if (focus) tabList.children[index].focus();
}

export function initTopics() {
  TOPICS.forEach((topic, index) => {
    const tab = h('button', {
      class: 'topic-tab', type: 'button', role: 'tab', id: `tab-${topic.id}`, 'aria-controls': 'topic-panel',
      onclick: () => select(index),
    });
    tab.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${topic.icon}</svg>`;
    tab.append(topic.title);
    tabList.append(tab);
  });
  tabList.addEventListener('keydown', (event) => {
    const current = [...tabList.children].indexOf(document.activeElement);
    const last = TOPICS.length - 1;
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  });
  select(0);
}
