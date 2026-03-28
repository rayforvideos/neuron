import type { Theme } from '../theme';
import { themeToCSS } from '../theme';

const BASE_STYLES = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-family);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
}

a { color: var(--color-primary); text-decoration: none; }

.neuron-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}
.neuron-header h1 { font-size: var(--font-size-lg); }
.neuron-header nav { display: flex; gap: var(--spacing-md); }
.neuron-header nav a { font-size: var(--font-size-md); }

.neuron-footer {
  padding: var(--spacing-lg);
  text-align: center;
  border-top: 1px solid var(--color-border);
  color: #888;
}

.neuron-hero {
  text-align: center;
  padding: var(--spacing-xl) var(--spacing-lg);
}
.neuron-hero h2 { font-size: var(--font-size-xl); margin-bottom: var(--spacing-sm); }
.neuron-hero p { margin-bottom: var(--spacing-md); color: #666; }

.neuron-btn {
  display: inline-block;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  cursor: pointer;
  font-size: var(--font-size-md);
  text-align: center;
  transition: background 0.2s, color 0.2s;
}
.neuron-btn--primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.neuron-btn--secondary { background: var(--color-secondary); color: #fff; border-color: var(--color-secondary); }
.neuron-btn--danger { background: var(--color-danger); color: #fff; border-color: var(--color-danger); }
.neuron-btn--ghost { background: transparent; color: var(--color-primary); border-color: transparent; }
.neuron-btn--default { background: var(--color-bg); color: var(--color-text); }

.neuron-product-grid {
  display: grid;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
}
.neuron-product-grid article {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--spacing-md);
  box-shadow: var(--shadow);
}

.neuron-cart-list { padding: var(--spacing-lg); }
.neuron-cart-list .cart-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border);
}

.neuron-cart-summary {
  padding: var(--spacing-lg);
  text-align: right;
  font-size: var(--font-size-lg);
  font-weight: bold;
}

.neuron-form {
  max-width: 480px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}
.neuron-form label {
  display: block;
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-md);
}
.neuron-form input {
  display: block;
  width: 100%;
  padding: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--font-size-md);
}
.neuron-form button[type="submit"] { width: 100%; margin-top: var(--spacing-md); }

.neuron-cart-icon { position: relative; cursor: pointer; }
.neuron-cart-icon .badge {
  position: absolute; top: -4px; right: -4px;
  background: var(--color-danger); color: #fff;
  font-size: 12px; width: 18px; height: 18px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
}

.neuron-search {
  width: 100%; padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--font-size-md);
}

.neuron-modal {
  display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); z-index: 100;
}
.neuron-modal.active { display: flex; align-items: center; justify-content: center; }
.neuron-modal-body {
  background: var(--color-bg); padding: var(--spacing-lg);
  border-radius: var(--radius); box-shadow: var(--shadow);
  min-width: 320px;
}

.neuron-text--sm { font-size: var(--font-size-sm); }
.neuron-text--md { font-size: var(--font-size-md); }
.neuron-text--lg { font-size: var(--font-size-lg); }
.neuron-text--xl { font-size: var(--font-size-xl); }

.neuron-grid { display: grid; gap: var(--spacing-md); padding: var(--spacing-md); }
.neuron-list { padding: var(--spacing-md); }
.neuron-section { padding: var(--spacing-md); }

.neuron-product-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--color-bg);
  box-shadow: var(--shadow);
  transition: transform 0.2s;
}
.neuron-product-card:hover { transform: translateY(-4px); }
.neuron-product-card__img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: #f5f5f7;
}
.neuron-product-card__body { padding: var(--spacing-md); }
.neuron-product-card__category {
  font-size: var(--font-size-sm);
  color: var(--color-secondary);
  margin-bottom: 4px;
}
.neuron-product-card__name {
  font-size: var(--font-size-md);
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}
.neuron-product-card__price {
  font-size: calc(var(--font-size-md) + 2px);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}
.neuron-product-card__btn { width: 100%; }

.neuron-cart-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--color-border);
  gap: var(--spacing-md);
}
.neuron-cart-item__img {
  width: 80px; height: 80px;
  object-fit: cover;
  border-radius: var(--radius);
  background: #f5f5f7;
}
.neuron-cart-item__info { flex: 1; }
.neuron-cart-item__info h4 { color: var(--color-text); margin-bottom: 4px; }
.neuron-cart-item__info p { color: var(--color-secondary); font-size: var(--font-size-sm); }
.neuron-cart-item__price {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 var(--spacing-md);
}
.neuron-cart-item__remove {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
}

.neuron-cart-summary__content {
  padding: var(--spacing-lg);
  background: #f5f5f7;
  border-radius: var(--radius);
  margin: var(--spacing-md) 0;
}
.neuron-cart-summary__row {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
  color: var(--color-secondary);
}
.neuron-cart-summary__total {
  display: flex;
  justify-content: space-between;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}
.neuron-cart-summary__total span:last-child { color: var(--color-primary); }

.neuron-empty {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-secondary);
  font-size: var(--font-size-lg);
}

input:invalid:not(:placeholder-shown) {
  border-color: var(--color-danger);
}

input:valid:not(:placeholder-shown) {
  border-color: var(--color-primary);
}

@media (max-width: 768px) {
  .neuron-product-grid,
  .neuron-grid {
    grid-template-columns: 1fr !important;
  }

  .neuron-header {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .neuron-header nav {
    flex-wrap: wrap;
    justify-content: center;
  }

  .neuron-hero {
    padding: var(--spacing-lg) var(--spacing-md);
  }
  .neuron-hero h2 {
    font-size: var(--font-size-lg);
  }

  .neuron-form {
    padding: var(--spacing-md);
    max-width: 100%;
  }

  .neuron-cart-item {
    flex-wrap: wrap;
  }
  .neuron-cart-item__img {
    width: 60px;
    height: 60px;
  }

  .neuron-modal-body {
    min-width: auto;
    margin: var(--spacing-md);
    max-width: calc(100vw - 48px);
  }
}
`;

const FADE_TRANSITION = `
[data-page] {
  opacity: 0;
  transition: opacity 0.3s ease;
  position: absolute;
  width: 100%;
}
[data-page].neuron-page-active {
  opacity: 1;
  position: relative;
}
`;

const SLIDE_TRANSITION = `
[data-page] {
  transform: translateX(20px);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
  position: absolute;
  width: 100%;
}
[data-page].neuron-page-active {
  transform: translateX(0);
  opacity: 1;
  position: relative;
}
`;

export function generateCSS(theme: Theme): string {
  let css = themeToCSS(theme) + '\n' + BASE_STYLES;
  if (theme.transition === 'fade') {
    css += '\n' + FADE_TRANSITION;
  } else if (theme.transition === 'slide') {
    css += '\n' + SLIDE_TRANSITION;
  }
  return css;
}
