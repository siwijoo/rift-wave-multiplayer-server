export const RARITIES = [
  { id: 'common', label: 'Comum', color: '#d1e2e7' },
  { id: 'rare', label: 'Rara', color: '#58b6ff' },
  { id: 'epic', label: 'Épica', color: '#b18cff' },
  { id: 'legendary', label: 'Lendária', color: '#ffba63' },
  { id: 'mythic', label: 'Mítica', color: '#ff669f' },
  { id: 'secret', label: 'Secreta', color: '#82fff1' },
  { id: 'divine', label: 'Divina', color: '#fff0ad' },
];

export const RUN_MODES = {
  classic: { label: 'Sobrevivência', detail: 'A experiência Rift Wave original.', count: 1, health: 1, damage: 1, score: 1, spawn: 1, salvage: 1 },
  blitz: { label: 'Blitz', detail: 'Ondas menores, inimigos mais rápidos, ação sem pausa.', count: 0.75, health: 0.92, damage: 1.1, score: 1.3, spawn: 0.58, salvage: 1.25 },
  chaos: { label: 'Caos Dimensional', detail: 'Mais drones de elite e anomalias inesperadas.', count: 1.18, health: 1.12, damage: 1.08, score: 1.55, spawn: 0.82, salvage: 1.4 },
};

export const SUPPLIES = [
  { id: 'repair', name: 'Reparação imediata', icon: '✚', cost: 40, detail: 'Recupera 50 de integridade.' },
  { id: 'shield', name: 'Blindagem instantânea', icon: '⬡', cost: 55, detail: 'Aumenta o escudo máximo em 15 e recarrega tudo.' },
  { id: 'overclock', name: 'Munição overclock', icon: 'ϟ', cost: 100, detail: '+12% de dano até o fim da partida.' },
];

export const CONTRACT_TYPES = [
  { id: 'kills', label: 'CAÇADA', icon: '⌖', unit: 'abates' },
  { id: 'damage', label: 'RUPTURA', icon: '✺', unit: 'dano' },
  { id: 'dash', label: 'PILOTO FANTASMA', icon: '»', unit: 'dashes' },
  { id: 'scan', label: 'RECONHECIMENTO', icon: '◉', unit: 'pulsos ÔMEGA' },
];
export function makeContract(wave, mode = 'classic') {
  const type = CONTRACT_TYPES[(wave + (mode === 'chaos' ? 1 : mode === 'blitz' ? 2 : 0)) % CONTRACT_TYPES.length];
  const goal = type.id === 'kills' ? Math.min(4 + wave, 16) : type.id === 'damage' ? 200 + wave * 85 : type.id === 'dash' ? 2 + Math.min(3, Math.floor(wave / 5)) : 1;
  return { id: type.id, label: type.label, icon: type.icon, unit: type.unit, goal, progress: 0, claimed: false, reward: 28 + Math.min(wave * 7, 120) };
}
export function advanceContract(run, kind, amount = 1) {
  const c = run.contract;
  if (!c || c.claimed || c.id !== kind || !(amount > 0)) return false;
  c.progress = Math.min(c.goal, c.progress + amount);
  if (c.progress < c.goal) return false;
  c.claimed = true; run.salvage += c.reward; run.contractsDone++;
  return true;
}
export function purchaseSupply(run, id) {
  const offer = SUPPLIES.find(x => x.id === id);
  if (!offer || run.salvage < offer.cost || (run.suppliesBought?.[id] ?? 0) >= (id === 'overclock' ? 3 : 1)) return false;
  run.salvage -= offer.cost;
  run.suppliesBought ??= {}; run.suppliesBought[id] = (run.suppliesBought[id] ?? 0) + 1;
  if (id === 'repair') run.hp = Math.min(run.maxHp, run.hp + 50);
  if (id === 'shield') { run.maxShield += 15; run.shield = run.maxShield; }
  if (id === 'overclock') run.damage += 0.12;
  return true;
}
export function getRank(xp) {
  const safe = Math.max(0, Math.floor(Number(xp) || 0));
  const level = Math.min(99, 1 + Math.floor(Math.sqrt(safe / 90)));
  const start = 90 * (level - 1) ** 2, next = 90 * level ** 2;
  return { level, progress: Math.max(0, safe - start), needed: Math.max(1, next - start), name: level >= 20 ? 'Lenda da Fenda' : level >= 10 ? 'Veterano' : level >= 5 ? 'Caçador' : 'Recruta' };
}

export const DIFFICULTIES = {
  explorer: { label: 'Explorador', health: 0.8, damage: 0.6, speed: 0.82, luck: 0.75 },
  normal: { label: 'Sobrevivente', health: 1, damage: 1, speed: 1, luck: 1 },
  rupture: { label: 'Ruptura', health: 1.28, damage: 1.3, speed: 1.13, luck: 1.35 },
};

export const WEAPONS = [
  { id: 'pulse', name: 'PULSO M1', rarity: 'common', kind: 'pulse', icon: '⌁',
    subtitle: 'Rifle de plasma', description: 'Disparos precisos e rápidos. Uma base confiável para qualquer build.',
    damage: 23, interval: 0.19, speed: 70, pellets: 1, spread: 0.008, color: '#71eee1', model: 'rifle' },
  { id: 'scatter', name: 'DUPLA HÉLICE', rarity: 'common', kind: 'scatter', icon: '⋈',
    subtitle: 'Escopeta de bobinas', description: 'Dois canos, cinco fragmentos de energia. Domina o combate próximo.',
    damage: 14, interval: 0.65, speed: 62, pellets: 5, spread: 0.1, color: '#e2e8f0', model: 'double' },
  { id: 'arc', name: 'ARC–9', rarity: 'rare', kind: 'arc', icon: 'ϟ',
    subtitle: 'Lançador de raios', description: 'Um raio instantâneo salta entre até três inimigos próximos.',
    damage: 38, interval: 0.48, speed: 0, pellets: 1, spread: 0, color: '#61baff', model: 'coil' },
  { id: 'frost', name: 'GEADA', rarity: 'rare', kind: 'frost', icon: '❄',
    subtitle: 'Submetralhadora criogênica', description: 'Alta cadência. Cada impacto desacelera o inimigo por dois segundos.',
    damage: 15, interval: 0.1, speed: 78, pellets: 1, spread: 0.025, color: '#a3ebff', model: 'smg' },
  { id: 'nova', name: 'NOVA–12', rarity: 'epic', kind: 'nova', icon: '✦',
    subtitle: 'Escopeta de energia', description: 'Onze estilhaços de plasma em um disparo. Limpa grupos à curta distância.',
    damage: 19, interval: 0.68, speed: 70, pellets: 11, spread: 0.12, color: '#b48cff', model: 'shotgun' },
  { id: 'helios', name: 'HÉLIOS', rarity: 'legendary', kind: 'lance', icon: '☀',
    subtitle: 'Lança solar', description: 'Um feixe de alta energia atravessa inimigos em linha e causa dano crítico.',
    damage: 112, interval: 0.8, speed: 0, pellets: 1, spread: 0, color: '#ffb34f', model: 'lance' },
  { id: 'rift', name: 'FENDA', rarity: 'mythic', kind: 'rift', icon: '◈',
    subtitle: 'Canhão dimensional', description: 'Lança um núcleo instável. A explosão atinge todos os drones em um raio de cinco metros.',
    damage: 125, interval: 1.05, speed: 25, pellets: 1, spread: 0, color: '#ff67a3', model: 'cannon' },
  { id: 'zero', name: 'PONTO ZERO', rarity: 'secret', kind: 'zero', icon: '◎',
    subtitle: 'Projetor de singularidades', description: 'Uma microfenda puxa inimigos, pulsa dano e implode. Surge somente a partir da onda 8.',
    damage: 150, interval: 1.35, speed: 20, pellets: 1, spread: 0, color: '#82fff1', model: 'singularity' },

  { id: 'neon', name: 'NEON-7', rarity: 'rare', kind: 'pulse', icon: '⟁', subtitle: 'Carabina de precisão', description: 'Carabina modular com projéteis velozes e dispersão mínima.', damage: 36, interval: 0.24, speed: 105, pellets: 1, spread: 0.003, color: '#66edba', model: 'carbine' },
  { id: 'venom', name: 'FERROADA', rarity: 'rare', kind: 'venom', icon: '♧', subtitle: 'Lançador de nanites', description: 'Dardos corrosivos causam dano contínuo após o impacto.', damage: 20, interval: 0.19, speed: 85, pellets: 1, spread: 0.017, color: '#b8fb63', model: 'spike' },
  { id: 'rail', name: 'MARTELO ÍON', rarity: 'epic', kind: 'rail', icon: '⇢', subtitle: 'Canhão eletromagnético', description: 'Perfura inimigos alinhados com um disparo de velocidade instantânea.', damage: 135, interval: 1.25, speed: 0, pellets: 1, spread: 0, color: '#6ab8ff', model: 'rail' },
  { id: 'ember', name: 'BRASA-X', rarity: 'epic', kind: 'ember', icon: '✹', subtitle: 'Projetor térmico', description: 'Plasma incandescente incendeia drones e causa dano residual.', damage: 20, interval: 0.13, speed: 55, pellets: 1, spread: 0.04, color: '#ff8d53', model: 'flame' },
  { id: 'crown', name: 'COROA', rarity: 'epic', kind: 'ricochet', icon: '❖', subtitle: 'Discos de choque', description: 'Cada acerto ricocheteia para outro alvo próximo com raio elétrico.', damage: 49, interval: 0.42, speed: 74, pellets: 1, spread: 0.018, color: '#d7a1ff', model: 'disc' },
  { id: 'atlas', name: 'ATLAS-X', rarity: 'legendary', kind: 'pulse', icon: '⊞', subtitle: 'Fuzil de longo alcance', description: 'Projéteis de altíssima velocidade e grande impacto em alvo único.', damage: 82, interval: 0.43, speed: 125, pellets: 1, spread: 0.001, color: '#ffdc81', model: 'sniper' },
  { id: 'tempest', name: 'TEMPESTADE', rarity: 'legendary', kind: 'arc', icon: 'ϟ', subtitle: 'Matriz de arcos elétricos', description: 'Encadeia descargas de alto dano e atordoa grupos de drones.', damage: 73, interval: 0.63, speed: 0, pellets: 1, spread: 0, color: '#80baff', model: 'ion' },
  { id: 'vortex', name: 'VÉRTICE', rarity: 'legendary', kind: 'vortex', icon: '◉', subtitle: 'Gerador gravitacional', description: 'Cria uma fenda que atrai hostis e enfraquece suas armaduras.', damage: 83, interval: 1.1, speed: 32, pellets: 1, spread: 0, color: '#90f9ed', model: 'rotary' },
  { id: 'quasar', name: 'QUASAR', rarity: 'mythic', kind: 'rift', icon: '✺', subtitle: 'Morteiro estelar', description: 'Uma explosão gravitacional de longo alcance atinge grandes grupos.', damage: 205, interval: 1.6, speed: 36, pellets: 1, spread: 0.01, color: '#ff6696', model: 'mortar' },
  { id: 'eclipse', name: 'ECLIPSE', rarity: 'mythic', kind: 'lance', icon: '☼', subtitle: 'Acelerador solar', description: 'Feixe contínuo por disparo que atravessa toda a linha de hostis.', damage: 185, interval: 1.18, speed: 0, pellets: 1, spread: 0, color: '#ffd5aa', model: 'burst' },
  { id: 'paradox', name: 'PARADOXO', rarity: 'secret', kind: 'zero', icon: '∞', subtitle: 'Confinador de horizonte', description: 'Projeta uma singularidade de alta massa com implosão devastadora.', damage: 250, interval: 1.78, speed: 27, pellets: 1, spread: 0, color: '#d1fff1', model: 'paradox' },

  { id: 'warden', name: 'WARDEN SR', rarity: 'rare', kind: 'pulse', icon: '⌖', subtitle: 'Fuzil tático de serviço', description: 'Plataforma tática com coice contido, ótima estabilidade e resposta rápida.', damage: 29, interval: 0.14, speed: 98, pellets: 1, spread: 0.006, color: '#7fe8d5', model: 'service' },
  { id: 'phantom', name: 'PHANTOM DMR', rarity: 'epic', kind: 'rail', icon: '⌁', subtitle: 'Rifle de precisão tático', description: 'Canaliza um disparo perfurante de alta precisão, ótimo para alinhar abates.', damage: 124, interval: 0.92, speed: 0, pellets: 1, spread: 0, color: '#9fd5ff', model: 'marksman' },
  { id: 'behemoth', name: 'BEHEMOTH MG', rarity: 'legendary', kind: 'pulse', icon: '▤', subtitle: 'Metralhadora pesada', description: 'Volume de fogo brutal, projéteis pesados e uma silhueta mais industrial.', damage: 27, interval: 0.075, speed: 88, pellets: 1, spread: 0.03, color: '#ffd37a', model: 'lmg' },

  { id: 'genesis', name: 'GÊNESE ∞', rarity: 'divine', kind: 'genesis', icon: '✺',
    subtitle: 'Forja do nascimento estelar', description: 'Dispara uma estrela comprimida: explosão monumental, dois pulsos estelares e raios que saltam entre drones. DIVINA • a partir da onda 12.',
    damage: 540, interval: 2.15, speed: 46, pellets: 1, spread: 0, color: '#ffe4a8', model: 'genesis' },
];

export const POWERS = [
  { id: 'vital', name: 'Núcleo vital', rarity: 'common', icon: '✚', description: '+25 de vida máxima e recuperação imediata de 35 de vida.', max: 6 },
  { id: 'damage', name: 'Amplificador', rarity: 'common', icon: '↗', description: '+15% de dano em todas as armas. Pode acumular.', max: 8 },
  { id: 'speed', name: 'Passo leve', rarity: 'common', icon: '»', description: '+12% de velocidade de movimento.', max: 4 },
  { id: 'shield', name: 'Barreira azul', rarity: 'rare', icon: '⬡', description: '+30 de escudo máximo. O escudo regenera após cinco segundos sem dano.', max: 4 },
  { id: 'double', name: 'Pulo duplo', rarity: 'rare', icon: '↟', description: 'Pule novamente no ar. Use para escapar de ataques e mudar de direção.', max: 1 },
  { id: 'haste', name: 'Circuito acelerado', rarity: 'rare', icon: '⏩', description: '+18% de cadência de tiro para qualquer arma.', max: 5 },
  { id: 'dash', name: 'Botas temporais', rarity: 'epic', icon: '➤', description: 'Dash custa menos energia e concede invulnerabilidade durante o impulso.', max: 2 },
  { id: 'vampire', name: 'Reciclagem', rarity: 'epic', icon: '♺', description: 'Destruir um inimigo recupera 3 pontos de vida.', max: 3 },
  { id: 'critical', name: 'Mira prismática', rarity: 'epic', icon: '⊕', description: '+15% de chance de crítico. Um crítico causa o dobro do dano.', max: 4 },
  { id: 'overdrive', name: 'Sobrecarga solar', rarity: 'legendary', icon: '☀', description: '+35% de dano e +20% de cadência de tiro.', max: 3 },
  { id: 'orbit', name: 'Satélites de defesa', rarity: 'legendary', icon: '◌', description: 'Dois satélites orbitam você e causam dano a inimigos próximos.', max: 2 },
  { id: 'phoenix', name: 'Protocolo Fênix', rarity: 'mythic', icon: '✧', description: 'Uma segunda chance: ressuscita com vida e escudo completos uma vez.', max: 1 },
  { id: 'prism', name: 'Prisma infinito', rarity: 'secret', icon: '◇', description: 'Duplica o dano e adiciona um projétil extra. Disponível a partir da onda 8.', max: 1 },

  { id: 'repair', name: 'Nanorreparação', rarity: 'rare', icon: '✣', description: 'Regenera 0,7 de vida por segundo enquanto estiver vivo.', max: 4 },
  { id: 'magnet', name: 'Coletor magnético', rarity: 'common', icon: '⊙', description: 'Atrai núcleos de cura de mais longe e aumenta sua cura.', max: 4 },
  { id: 'armor', name: 'Blindagem reativa', rarity: 'rare', icon: '▣', description: 'Reduz em 9% o dano recebido, cumulativo até 45%.', max: 5 },
  { id: 'chain', name: 'Condutor de arco', rarity: 'epic', icon: 'ϟ', description: 'Armas elétricas atingem um alvo extra a cada nível.', max: 3 },
  { id: 'reactor', name: 'Reator instável', rarity: 'legendary', icon: '✷', description: 'Abates produzem ondas de choque que danificam drones próximos.', max: 3 },
  { id: 'stabilizer', name: 'Empunhadura neural', rarity: 'common', icon: '⌖', description: 'Reduz a dispersão dos disparos e o recuo visual.', max: 4 },
  { id: 'adrenaline', name: 'Protocolo adrenalina', rarity: 'epic', icon: '♥', description: 'Abaixo de 40% de vida, causa dano adicional.', max: 3 },
  { id: 'hunter', name: 'Caçador de colossos', rarity: 'rare', icon: '◎', description: 'Causa 20% a mais de dano contra Guardiões a cada nível.', max: 4 },
  { id: 'fortune', name: 'Olho do infinito', rarity: 'legendary', icon: '✧', description: 'Aumenta a chance das recompensas de alta raridade.', max: 3 },
  { id: 'firewall', name: 'Sistema antichamas', rarity: 'epic', icon: '⬢', description: 'Ganha resistência adicional e recarrega o dash mais rápido.', max: 3 },
  { id: 'omega-lens', name: 'ÔMEGA · Lente espectral', rarity: 'common', icon: '◉', system: 'visor', description: 'Alcance do scanner +12 metros e mais 1 alvo marcado por pulso.', max: 2 },
  { id: 'omega-precision', name: 'ÔMEGA · Mira preditiva', rarity: 'rare', icon: '⌖', system: 'visor', description: '+15% de dano contra drones marcados pelo tapa-olho.', max: 2 },
  { id: 'omega-jammer', name: 'ÔMEGA · Interferência', rarity: 'epic', icon: 'ϟ', system: 'visor', description: 'Pulso de rastreio atrasa os movimentos dos alvos marcados por 3 segundos.', max: 1 },
  { id: 'omega-capacitor', name: 'ÔMEGA · Capacitor', rarity: 'epic', icon: '⬡', system: 'visor', description: 'Diminui o recarregamento em 5 segundos e restaura 12 de escudo por pulso.', max: 2 },
  { id: 'omega-hunter', name: 'ÔMEGA · Caçador', rarity: 'legendary', icon: '✧', system: 'visor', description: 'Marca +2 inimigos. Alvos marcados revelam nível de vida no sensor.', max: 1 },
  { id: 'omega-emp', name: 'ÔMEGA · Descarga', rarity: 'mythic', icon: '✹', system: 'visor', description: 'Cada pulso descarrega 35 de dano elétrico em inimigos marcados.', max: 2 },
  { id: 'omega-modmenu', name: 'ÔMEGA · MOD MENU', rarity: 'secret', icon: '⌘', system: 'visor', description: 'Sistema experimental secreto: menu com Aimbot, Fast Fire, ESP, Spin Bot, Rage Bot e controle do cone de mira.', max: 1 },
  { id: 'omega-oracle', name: 'ÔMEGA · Oráculo', rarity: 'secret', icon: '∞', system: 'visor', description: 'Marca TODOS os alvos no alcance. Scanner pronto em apenas 5 segundos.', max: 1 },
];

export function createRun(difficulty = 'normal', mode = 'classic') {
  return { difficulty, mode: RUN_MODES[mode] ? mode : 'classic', salvage: 0, contractsDone: 0, contract: null, suppliesBought: {}, wave: 0, score: 0, kills: 0, weapon: 'pulse', weapons: ['pulse'], weaponSlot: 0, upgrades: {},
    maxHp: 100, hp: 100, maxShield: 50, shield: 50, energy: 100,
    damage: 1, fireRate: 1, moveSpeed: 6.2, maxJumps: 1,
    critical: 0.05, dashCost: 35, dashInvulnerable: false, phoenix: false,
    lifeSteal: 0, orbit: 0, extraProjectile: 0, hpRegen: 0, magnet: 0, armor: 0, extraChains: 0, shockwave: 0, stability: 1, adrenaline: 0, bossDamage: 0, luckBonus: 0, dashRegen: 1, anomaly: null,
    visor: { level: 1, range: 24, targets: 1, damageBonus: 0, slow: false, recharge: 18, shield: 0, emp: 0, healthReadout: false, oracle: false },
    scanCooldown: 0, mods: { unlocked: false, aimbot: false, fastFire: false, esp: false, spinBot: false, rageBot: false, overcharge: false, aimFov: 46 } };
}

export function rarityWeights(wave, difficulty = 'normal') {
  const progress = Math.max(0, wave - 1);
  const luck = DIFFICULTIES[difficulty]?.luck ?? 1;
  return [
    Math.max(25, 68 - progress * 2),
    (22 + Math.min(progress, 15)) * luck,
    (7 + Math.min(progress * 0.9, 16)) * luck,
    (2.5 + Math.min(progress * 0.35, 8)) * luck,
    (0.5 + Math.min(progress * 0.12, 2.4)) * luck,
    wave >= 8 ? Math.min(0.15 + (wave - 8) * 0.055, 0.9) * luck : 0,
    // The divine tier is ~0.02-0.08% per reward, many times rarer than Secret.
    wave >= 12 ? Math.min(0.028 + (wave - 12) * 0.0014, 0.11) * luck : 0,
  ];
}

export function rollRarity(wave, difficulty, random = Math.random) {
  const weights = rarityWeights(wave, difficulty);
  let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < weights.length; i++) {
    ticket -= weights[i];
    if (ticket < 0) return RARITIES[i].id;
  }
  return 'common';
}


function ensureInventory(run) {
  if (!Array.isArray(run.weapons) || !run.weapons.length) run.weapons = [run.weapon ?? 'pulse'];
  if (!Number.isInteger(run.weaponSlot) || run.weaponSlot < 0) run.weaponSlot = Math.max(0, run.weapons.indexOf(run.weapon ?? run.weapons[0]));
  if (!run.weapons.includes(run.weapon)) run.weapon = run.weapons[run.weaponSlot] ?? run.weapons[0];
  if (!run.weapons[run.weaponSlot]) run.weaponSlot = 0;
  run.weapon = run.weapons[run.weaponSlot] ?? run.weapons[0];
}

export function switchWeapon(run, slot) {
  ensureInventory(run);
  if (slot < 0 || slot >= run.weapons.length) return run.weapon;
  run.weaponSlot = slot;
  run.weapon = run.weapons[slot];
  return run.weapon;
}

export function grantWeapon(run, weaponId, replaceSlot = null) {
  ensureInventory(run);
  const existing = run.weapons.indexOf(weaponId);
  if (existing >= 0) return switchWeapon(run, existing);
  if (run.weapons.length < 3) {
    run.weapons.push(weaponId);
    return switchWeapon(run, run.weapons.length - 1);
  }
  const slot = replaceSlot == null ? run.weaponSlot : Math.max(0, Math.min(run.weapons.length - 1, replaceSlot));
  run.weapons[slot] = weaponId;
  return switchWeapon(run, slot);
}

export function chooseRewards(run, random = Math.random) {
  ensureInventory(run);
  const pool = [
    ...WEAPONS.filter(weapon => !run.weapons.includes(weapon.id)).map(weapon => ({ ...weapon, type: 'weapon' })),
    ...POWERS.filter(power => (run.upgrades[power.id] ?? 0) < power.max).map(power => ({ ...power, type: 'power' })),
  ].filter(item => (item.rarity !== 'secret' || run.wave >= 8) && (item.rarity !== 'divine' || run.wave >= 12));
  const picks = [];
  for (let slot = 0; slot < 3; slot++) {
    const rolled = rollRarity(run.wave, run.difficulty, random);
    const rank = RARITIES.findIndex(r => r.id === rolled);
    const rarity = run.luckBonus && random() < run.luckBonus && rank < 4 ? RARITIES[rank + 1].id : rolled;
    let eligible = pool.filter(item => item.rarity === rarity && !picks.some(pick => pick.id === item.id));
    if (!eligible.length) eligible = pool.filter(item => !picks.some(pick => pick.id === item.id) && (item.rarity !== 'divine' || rolled === 'divine'));
    picks.push(eligible[Math.min(eligible.length - 1, Math.floor(random() * eligible.length))]);
  }
  return picks;
}

export function applyReward(run, reward) {
  if (reward.type === 'weapon') { grantWeapon(run, reward.id); return; }
  run.upgrades[reward.id] = (run.upgrades[reward.id] ?? 0) + 1;
  switch (reward.id) {
    case 'vital': run.maxHp += 25; run.hp = Math.min(run.maxHp, run.hp + 35); break;
    case 'damage': run.damage += 0.15; break;
    case 'speed': run.moveSpeed *= 1.12; break;
    case 'shield': run.maxShield += 30; run.shield = run.maxShield; break;
    case 'double': run.maxJumps = 2; break;
    case 'haste': run.fireRate += 0.18; break;
    case 'dash': run.dashCost = Math.max(15, run.dashCost - 8); run.dashInvulnerable = true; break;
    case 'vampire': run.lifeSteal += 3; break;
    case 'critical': run.critical = Math.min(0.8, run.critical + 0.15); break;
    case 'overdrive': run.damage += 0.35; run.fireRate += 0.2; break;
    case 'orbit': run.orbit += 2; break;
    case 'phoenix': run.phoenix = true; break;
    case 'prism': run.damage *= 2; run.extraProjectile = 1; break;
    case 'repair': run.hpRegen += 0.7; break;
    case 'magnet': run.magnet += 1.5; break;
    case 'armor': run.armor = Math.min(0.45, run.armor + 0.09); break;
    case 'chain': run.extraChains++; break;
    case 'reactor': run.shockwave++; break;
    case 'stabilizer': run.stability *= 0.78; break;
    case 'adrenaline': run.adrenaline += 0.22; break;
    case 'hunter': run.bossDamage += 0.2; break;
    case 'fortune': run.luckBonus = Math.min(0.45, run.luckBonus + 0.15); break;
    case 'firewall': run.armor = Math.min(0.45, run.armor + 0.05); run.dashRegen += 0.17; break;
    case 'omega-lens': run.visor.level++; run.visor.range += 12; run.visor.targets++; break;
    case 'omega-precision': run.visor.level++; run.visor.damageBonus += 0.15; break;
    case 'omega-jammer': run.visor.level++; run.visor.slow = true; break;
    case 'omega-capacitor': run.visor.level++; run.visor.recharge = Math.max(6, run.visor.recharge - 5); run.visor.shield += 12; break;
    case 'omega-hunter': run.visor.level++; run.visor.targets += 2; run.visor.healthReadout = true; break;
    case 'omega-emp': run.visor.level++; run.visor.emp += 35; break;
    case 'omega-oracle': run.visor.level++; run.visor.oracle = true; run.visor.recharge = 5; break;
    case 'omega-modmenu': run.visor.level++; run.mods.unlocked = true; break;
  }
}

export function wavePlan(wave, difficulty, mode = 'classic') {
  const config = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  const spec = RUN_MODES[mode] ?? RUN_MODES.classic;
  return { count: Math.max(4, Math.min(mode === 'chaos' ? 42 : 38, Math.round((5 + wave * 2) * spec.count))), boss: wave % 5 === 0,
    hp: (1 + (wave - 1) * 0.17) * config.health * spec.health,
    speed: (1 + Math.min((wave - 1) * 0.035, 0.7)) * config.speed,
    damage: (1 + (wave - 1) * 0.065) * config.damage * spec.damage };
}

export function raySphere(origin, direction, center, radius, range = Infinity) {
  const x = origin.x - center.x, y = origin.y - center.y, z = origin.z - center.z;
  const b = x * direction.x + y * direction.y + z * direction.z;
  const c = x * x + y * y + z * z - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const distance = -b - root >= 0 ? -b - root : -b + root;
  return distance >= 0 && distance <= range ? distance : null;
}