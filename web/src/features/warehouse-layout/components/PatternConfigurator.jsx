/**
 * Pattern Configurator Component (STEP 11)
 * Interactive pattern editor with token chips and live client sample generation.
 */

import React, { useMemo } from 'react';
import codeUtils from '../../../../../shared/layout-core/src/code.js';

const {
  DEFAULT_PATTERN,
  renderPattern,
  validatePattern,
} = codeUtils;

const TOKENS = [
  { token: '{aisle}', label: 'Lorong', example: 'A01' },
  { token: '{rack}', label: 'Rak', example: 'R01' },
  { token: '{bay}', label: 'Bay', example: '01' },
  { token: '{level}', label: 'Level', example: '02' },
  { token: '{position}', label: 'Posisi', example: '03' },
];

const PRESETS = [
  { name: 'Standar Susuno', pattern: '{aisle}-{rack}-{bay}-{level}-{position}', sep: '-' },
  { name: 'Slash Delimited', pattern: '{aisle}/{rack}/{bay}/{level}/{position}', sep: '/' },
  { name: 'Underscore', pattern: '{aisle}_{rack}_{bay}_{level}_{position}', sep: '_' },
  { name: 'Titik Ringkas', pattern: '{aisle}.{rack}.{bay}.{level}.{position}', sep: '.' },
];

export default function PatternConfigurator({
  pattern = DEFAULT_PATTERN,
  separator = '-',
  onChangePattern,
  onChangeSeparator,
  sampleSegments = {
    aisle: 'A01',
    rack: 'RK01',
    bay: 1,
    level: 2,
    position: 3,
  },
}) {
  // Validasi token wajib
  const validation = useMemo(() => {
    return validatePattern(pattern);
  }, [pattern]);

  // Kalkulasi sampel kode langsung di klien
  const liveSample = useMemo(() => {
    if (!validation.valid) return 'Pola Belum Lengkap';
    return renderPattern(sampleSegments, pattern, separator);
  }, [pattern, separator, sampleSegments, validation.valid]);

  const handleInsertToken = (token) => {
    if (!pattern.toLowerCase().includes(token.toLowerCase())) {
      const newPattern = pattern ? `${pattern}${separator}${token}` : token;
      onChangePattern(newPattern);
    }
  };

  return (
    <div className="pattern-configurator">
      {/* 1. Preset Buttons */}
      <div className="pattern-presets-row">
        <span className="preset-label">Template Pola:</span>
        <div className="preset-buttons">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className={`btn-preset-pill ${pattern === p.pattern ? 'btn-preset-active' : ''}`}
              onClick={() => {
                onChangePattern(p.pattern);
                if (onChangeSeparator) onChangeSeparator(p.sep);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Pattern Input Field */}
      <div className="pattern-input-group">
        <label className="input-field-label">Format Pola Kode Lokasi</label>
        <div className="pattern-input-wrapper">
          <input
            type="text"
            className={`pattern-input ${!validation.valid ? 'pattern-input-invalid' : ''}`}
            value={pattern}
            onChange={(e) => onChangePattern(e.target.value)}
            placeholder="{aisle}-{rack}-{bay}-{level}-{position}"
          />
          <span className={`pattern-status-badge ${validation.valid ? 'badge-valid' : 'badge-invalid'}`}>
            {validation.valid ? '✓ Format Valid' : `⚠️ Kurang: ${validation.missingTokens.join(', ')}`}
          </span>
        </div>
      </div>

      {/* 3. Token Insertion Chips */}
      <div className="token-chips-group">
        <span className="token-chips-title">Klik token untuk menyisipkan ke pola:</span>
        <div className="token-chips-list">
          {TOKENS.map((t) => {
            const isIncluded = pattern.toLowerCase().includes(t.token.toLowerCase());
            return (
              <button
                key={t.token}
                type="button"
                className={`btn-token-chip ${isIncluded ? 'token-chip-used' : 'token-chip-unused'}`}
                onClick={() => handleInsertToken(t.token)}
                title={`Sisipkan ${t.token} (Contoh: ${t.example})`}
              >
                <span className="chip-code">{t.token}</span>
                <span className="chip-name">({t.label})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Separator Selector */}
      <div className="separator-selector-row">
        <label className="input-field-label">Karakter Pemisah (Separator):</label>
        <div className="separator-options">
          {['-', '/', '.', '_'].map((sep) => (
            <label key={sep} className="separator-radio-label">
              <input
                type="radio"
                name="separator"
                value={sep}
                checked={separator === sep}
                onChange={() => onChangeSeparator && onChangeSeparator(sep)}
              />
              <span className="separator-char-box">
                {sep === '-' ? 'Dash (-)' : sep === '/' ? 'Slash (/)' : sep === '.' ? 'Dot (.)' : 'Underscore (_)'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 5. Live Client Preview Card */}
      <div className="pattern-live-preview-card">
        <div className="preview-header">
          <span className="preview-title">Contoh Kode yang Dihasilkan:</span>
          <span className="preview-note">Segmen: Lorong {sampleSegments.aisle}, Rak {sampleSegments.rack}, Bay {sampleSegments.bay}, Lvl {sampleSegments.level}, Pos {sampleSegments.position}</span>
        </div>
        <div className="preview-rendered-code">
          <code>{liveSample}</code>
        </div>
      </div>
    </div>
  );
}
