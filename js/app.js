(function () {
  'use strict';

  var SKETCHFAB_API_VERSION = '1.12.1';
  var debugPick =
    typeof window !== 'undefined' &&
    window.location.search.indexOf('debug=1') !== -1;

  var bikeSelect = document.getElementById('bike-select');
  var viewerStatus = document.getElementById('viewer-status');
  var viewerError = document.getElementById('viewer-error');
  var partDetail = document.getElementById('part-detail');
  var partsGuide = document.getElementById('parts-guide');
  var creditsBlock = document.getElementById('credits-block');

  var catalog = { bikes: [] };
  var currentBike = null;
  var currentApi = null;

  function setError(msg) {
    if (!msg) {
      viewerError.hidden = true;
      viewerError.textContent = '';
      return;
    }
    viewerError.hidden = false;
    viewerError.textContent = msg;
  }

  function setStatus(text) {
    viewerStatus.textContent = text;
  }

  function materialKey(material) {
    if (material == null) return null;
    if (typeof material === 'string') return material;
    if (typeof material === 'object') {
      if (material.name) return String(material.name);
      if (material.uid != null) return String(material.uid);
      if (material.id != null) return String(material.id);
    }
    return String(material);
  }

  function resolvePart(bike, pick) {
    if (!pick) return null;

    var byInst = bike.partsByInstanceId || {};
    var byMat = bike.partsByMaterialId || {};

    if (pick.instanceID != null) {
      var iid = String(pick.instanceID);
      if (byInst[iid]) return { source: 'mesh', info: byInst[iid] };
    }

    var mk = materialKey(pick.material);
    if (mk && byMat[mk]) return { source: 'material', info: byMat[mk] };

    return null;
  }

  function renderPartPlaceholder() {
    partDetail.innerHTML =
      '<p class="muted">Click a part on the model, or use the reference list.</p>';
  }

  function renderPartResolved(part, pick) {
    var h = document.createElement('h3');
    h.textContent = part.name;
    var p = document.createElement('p');
    p.textContent = part.purpose;
    partDetail.innerHTML = '';
    partDetail.appendChild(h);
    partDetail.appendChild(p);
    if (debugPick && pick) {
      var dbg = document.createElement('p');
      dbg.className = 'small muted';
      dbg.textContent =
        'Debug: instanceID=' +
        (pick.instanceID != null ? pick.instanceID : '—') +
        ', material=' +
        (materialKey(pick.material) || '—');
      partDetail.appendChild(dbg);
    }
  }

  function renderPartUnknown(pick) {
    var h = document.createElement('h3');
    h.textContent = 'Unmapped part';
    var p = document.createElement('p');
    p.textContent =
      'This hit is not in your JSON map yet. Add it under partsByInstanceId (or partsByMaterialId). Append ?debug=1 to the URL and click again to log IDs in the panel and console.';
    partDetail.innerHTML = '';
    partDetail.appendChild(h);
    partDetail.appendChild(p);
    if (debugPick && pick) {
      var dbg = document.createElement('p');
      dbg.className = 'small muted';
      dbg.textContent =
        'instanceID=' +
        (pick.instanceID != null ? pick.instanceID : '—') +
        ', material=' +
        (materialKey(pick.material) || '—');
      partDetail.appendChild(dbg);
    }
  }

  function renderCredits(bike) {
    creditsBlock.innerHTML = '';
    var title = document.createElement('p');
    var strong = document.createElement('strong');
    strong.textContent = bike.title;
    title.appendChild(strong);
    creditsBlock.appendChild(title);

    var author = document.createElement('p');
    author.appendChild(document.createTextNode('By '));
    var a = document.createElement('a');
    a.href = bike.authorProfileUrl;
    a.rel = 'noopener noreferrer';
    a.textContent = bike.author;
    author.appendChild(a);
    creditsBlock.appendChild(author);

    var link = document.createElement('p');
    var m = document.createElement('a');
    m.href = bike.modelUrl;
    m.rel = 'noopener noreferrer';
    m.textContent = 'View on Sketchfab';
    link.appendChild(m);
    creditsBlock.appendChild(link);

    var lic = document.createElement('p');
    lic.className = 'muted small';
    lic.textContent = 'License: ' + bike.license;
    creditsBlock.appendChild(lic);
  }

  function renderPartsGuide(bike) {
    partsGuide.innerHTML = '';
    var items = bike.partsGuide || [];
    for (var i = 0; i < items.length; i++) {
      var li = document.createElement('li');
      var strong = document.createElement('strong');
      strong.textContent = items[i].name;
      var span = document.createElement('span');
      span.textContent = items[i].purpose;
      li.appendChild(strong);
      li.appendChild(span);
      partsGuide.appendChild(li);
    }
  }

  function mountFreshIframe() {
    var wrap = document.querySelector('.iframe-wrap');
    var old = document.getElementById('api-frame');
    var fresh = document.createElement('iframe');
    fresh.id = 'api-frame';
    fresh.title = 'Sketchfab 3D viewer';
    fresh.src = '';
    fresh.setAttribute('allow', 'autoplay; fullscreen; xr-spatial-tracking');
    fresh.setAttribute('allowfullscreen', '');
    fresh.setAttribute('mozallowfullscreen', 'true');
    fresh.setAttribute('webkitallowfullscreen', '');
    wrap.replaceChild(fresh, old);
    return fresh;
  }

  function initViewer(bike) {
    if (typeof Sketchfab === 'undefined') {
      setError('Sketchfab viewer script failed to load.');
      setStatus('');
      return;
    }

    setError('');
    setStatus('Loading 3D viewer…');
    renderPartPlaceholder();
    currentBike = bike;
    renderCredits(bike);
    renderPartsGuide(bike);

    var iframe = mountFreshIframe();
    currentApi = null;

    var client = new Sketchfab(SKETCHFAB_API_VERSION, iframe);

    client.init(
      bike.uid,
      {
        success: function (api) {
          currentApi = api;
          api.start();
          api.addEventListener('viewerready', function () {
            setStatus('Click the model to identify mapped parts.');
            api.addEventListener(
              'click',
              function (info) {
                if (debugPick && info) {
                  window.console.log('[bike-showcase] click', info);
                }
                if (!currentBike) return;
                if (!info || info.instanceID == null) {
                  renderPartPlaceholder();
                  return;
                }
                var resolved = resolvePart(currentBike, info);
                if (resolved && resolved.info) {
                  renderPartResolved(resolved.info, info);
                } else {
                  renderPartUnknown(info);
                }
              },
              { pick: 'fast' }
            );
          });
        },
        error: function () {
          setStatus('');
          setError(
            'Could not start the Sketchfab viewer. Check the model UID and your network connection.'
          );
        },
        ui_controls: 1,
        ui_infos: 0,
        ui_watermark: 1,
        autostart: 1,
      }
    );
  }

  function populateSelect(bikes) {
    bikeSelect.innerHTML = '';
    for (var i = 0; i < bikes.length; i++) {
      var b = bikes[i];
      var opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.title;
      bikeSelect.appendChild(opt);
    }
  }

  function selectedBike() {
    var id = bikeSelect.value;
    for (var i = 0; i < catalog.bikes.length; i++) {
      if (catalog.bikes[i].id === id) return catalog.bikes[i];
    }
    return catalog.bikes[0] || null;
  }

  function onBikeChange() {
    var bike = selectedBike();
    if (bike) initViewer(bike);
  }

  fetch('data/bikes.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      catalog = data;
      if (!catalog.bikes || !catalog.bikes.length) {
        setStatus('');
        setError('No bikes defined in data/bikes.json.');
        return;
      }
      populateSelect(catalog.bikes);
      bikeSelect.addEventListener('change', onBikeChange);
      initViewer(catalog.bikes[0]);
    })
    .catch(function () {
      setStatus('');
      setError('Could not load data/bikes.json. Serve this site over http://localhost (not file://).');
    });
})();
