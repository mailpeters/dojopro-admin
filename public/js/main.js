document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.querySelectorAll('[data-tabs]').forEach(container => {
    const tabs = container.querySelectorAll('.tab');
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-tab');
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-' + target).classList.add('active');
      });
    });
  });

  // Color pickers sync
  function syncColor(input, hexInput, swatchId, cssVar){
    const update = (val) => {
      hexInput.value = val;
      const preview = document.getElementById('brandPreview');
      if (preview) preview.style.setProperty(cssVar, val);
      const sw = document.getElementById(swatchId);
      if (sw) sw.style.background = val;
    };
    input.addEventListener('input', e => update(e.target.value));
    hexInput.addEventListener('input', e => {
      const v = e.target.value;
      if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v)) {
        input.value = v;
        update(v);
      }
    });
    update(input.value);
  }

  syncColor(
    document.getElementById('primary_color'),
    document.getElementById('primary_color_hex'),
    'swatchPrimary',
    '--primary'
  );
  syncColor(
    document.getElementById('secondary_color'),
    document.getElementById('secondary_color_hex'),
    'swatchSecondary',
    '--secondary'
  );

  // Logo preview
  const logoInput = document.getElementById('logo');
  const logoPreview = document.getElementById('logoPreview');
  if (logoInput && logoPreview) {
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      logoPreview.src = url;
      const brandLogo = document.querySelector('.brand-logo');
      if (brandLogo) brandLogo.src = url;
    });
  }
});
