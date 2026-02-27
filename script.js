const controls = {
  primaryColor: document.getElementById('primaryColor'),
  accentColor: document.getElementById('accentColor'),
  bgStart: document.getElementById('bgStart'),
  bgEnd: document.getElementById('bgEnd'),
  headingSize: document.getElementById('headingSize'),
  bodySize: document.getElementById('bodySize'),
  fontFamily: document.getElementById('fontFamily'),
  radius: document.getElementById('radius'),
  padding: document.getElementById('padding'),
  shadow: document.getElementById('shadow'),
  align: document.getElementById('align'),
  titleText: document.getElementById('titleText'),
  subtitleText: document.getElementById('subtitleText'),
  buttonText: document.getElementById('buttonText'),
};

const heroTitle = document.getElementById('heroTitle');
const heroSubtitle = document.getElementById('heroSubtitle');
const heroButton = document.getElementById('heroButton');
const ctaBtn = document.getElementById('ctaBtn');

function apply() {
  const root = document.documentElement.style;
  root.setProperty('--primary', controls.primaryColor.value);
  root.setProperty('--accent', controls.accentColor.value);
  root.setProperty('--bg-start', controls.bgStart.value);
  root.setProperty('--bg-end', controls.bgEnd.value);
  root.setProperty('--heading-size', `${controls.headingSize.value}px`);
  root.setProperty('--body-size', `${controls.bodySize.value}px`);
  root.setProperty('--font-family', controls.fontFamily.value);
  root.setProperty('--radius', `${controls.radius.value}px`);
  root.setProperty('--padding', `${controls.padding.value}px`);
  root.setProperty('--shadow', controls.shadow.value);
  root.setProperty('--align', controls.align.value);

  heroTitle.textContent = controls.titleText.value;
  heroSubtitle.textContent = controls.subtitleText.value;
  heroButton.textContent = controls.buttonText.value;
  ctaBtn.textContent = controls.buttonText.value;
}

Object.values(controls).forEach((el) => {
  el.addEventListener('input', apply);
  el.addEventListener('change', apply);
});

function randHex() {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

document.getElementById('randomBtn').addEventListener('click', () => {
  controls.primaryColor.value = randHex();
  controls.accentColor.value = randHex();
  controls.bgStart.value = randHex();
  controls.bgEnd.value = randHex();
  controls.headingSize.value = Math.floor(Math.random() * 48) + 24;
  controls.bodySize.value = Math.floor(Math.random() * 12) + 12;
  controls.radius.value = Math.floor(Math.random() * 40);
  controls.padding.value = Math.floor(Math.random() * 52) + 12;
  controls.shadow.value = Math.floor(Math.random() * 60);
  controls.align.value = ['left', 'center', 'right'][Math.floor(Math.random() * 3)];
  apply();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  location.reload();
});

apply();
