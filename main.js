document.addEventListener('DOMContentLoaded', () => {
    // --- SERVER CONFIG (from CSV Order) ---
    const SERVER_URL = '/upload';
    let selectedFileN8n = null;

    // --- UI Context & Navigation ---
    const dateDisplay = document.getElementById('current-date');
    if (dateDisplay) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = now.toLocaleDateString('es-ES', options);
    }

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    const chartInstances = {};

    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.dashboard-section');
    const viewTitle = document.getElementById('view-title');
    const viewDesc = document.getElementById('view-description');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.id;
            const targetSection = targetId.replace('nav-', 'section-');

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            sections.forEach(s => s.style.display = 'none');
            const activeSection = document.getElementById(targetSection);
            if (activeSection) {
                activeSection.style.display = 'block';
                // Asegurar que los gráficos se ajusten al tamaño del nuevo contenedor
                Object.values(chartInstances).forEach(chart => {
                    if (chart && typeof chart.resize === 'function') chart.resize();
                });
            }

            // Centralización de Headers (Evita parches repetitivos)
            const viewConfigs = {
                'nav-dashboard': { title: 'Intelligence Resumen', desc: 'Análisis consolidado de patrones detectados en el scraping.' },
                'nav-cleaner': { title: 'Limpiar Basura CSV', desc: 'Envía tus datos brutos a n8n para estructurar el reporte técnico.' },
                'nav-meta': { title: 'Competencia en Meta', desc: 'Score de Victoria y Longevidad estratégica.' }
            };

            if (viewConfigs[targetId]) {
                viewTitle.textContent = viewConfigs[targetId].title;
                viewDesc.textContent = viewConfigs[targetId].desc;
            }
        });
    });

    // --- n8n CLEANER LOGIC (CSV Upload) ---
    const dropZoneN8n = document.getElementById('drop-zone-n8n');
    const fileInputN8n = document.getElementById('file-input-n8n');
    const fileNameN8n = document.getElementById('file-name-n8n');
    const convertBtnN8n = document.getElementById('convert-btn-n8n');
    const statusAreaN8n = document.getElementById('n8n-status-area');
    const statusTextN8n = document.getElementById('n8n-status-text');
    const loaderN8n = document.getElementById('n8n-loader');

    dropZoneN8n?.addEventListener('click', () => fileInputN8n.click());

    fileInputN8n?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
            selectedFileN8n = file;
            fileNameN8n.innerHTML = `<strong>${file.name}</strong> seleccionado`;
            convertBtnN8n.style.display = 'block';
            convertBtnN8n.disabled = false;
            statusAreaN8n.style.display = 'none';
        }
    });

    convertBtnN8n?.addEventListener('click', async () => {
        if (!selectedFileN8n) return;

        convertBtnN8n.disabled = true;
        statusAreaN8n.style.display = 'block';
        loaderN8n.style.display = 'block';
        statusTextN8n.textContent = 'Enviando a n8n...';
        statusTextN8n.style.color = '#ffffff';

        const formData = new FormData();
        formData.append('data', selectedFileN8n);

        try {
            const response = await axios.post(SERVER_URL, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            loaderN8n.style.display = 'none';
            statusTextN8n.textContent = '¡Enviado con éxito! Revisa Google Drive.';
            statusTextN8n.style.color = '#00df82';

            // Permitir enviar otro tras 4 segundos
            setTimeout(() => {
                selectedFileN8n = null;
                fileInputN8n.value = '';
                fileNameN8n.innerHTML = '<strong>Haz clic</strong> o arrastra el CSV aquí';
                convertBtnN8n.style.display = 'none';
                statusAreaN8n.style.display = 'none';
            }, 4000);

        } catch (error) {
            loaderN8n.style.display = 'none';
            convertBtnN8n.disabled = false;

            let errorMsg = 'Error en el envío.';
            if (error.response && error.response.data && error.response.data.error) {
                errorMsg = error.response.data.error;
            } else {
                errorMsg = error.message;
            }

            statusTextN8n.textContent = errorMsg;
            statusTextN8n.style.color = '#ff4d4d';
            console.error("n8n Error Detail:", error.response ? error.response.data : error.message);
        }
    });

    // --- EXCEL INTELLIGENCE LOGIC ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusText = document.getElementById('upload-status');
 
    dropZone?.addEventListener('click', () => fileInput.click());


    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            processExcel(file);
            fileInput.value = '';
        }
    });

    const parseMetaDate = (dateStr) => {
        if (!dateStr) return null;

        const dateStrClean = String(dateStr).trim();

        // Formato 1: Bruto de Meta (desde el XX mes. XXXX)
        const months = {
            'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
        };

        const regex = /desde\s+el\s+(\d+)\s+([a-z]+)\.?\s+(?:de\s+)?(\d+)/i;
        const match = dateStrClean.match(regex);

        if (match) {
            const d = parseInt(match[1]);
            const mName = match[2].toLowerCase().replace('.', '');
            const m = months[mName];
            const y = parseInt(match[3]);
            if (m !== undefined && !isNaN(d) && !isNaN(y)) {
                return new Date(y, m, d);
            }
        }

        // Formato 2: Ya ordenado (Excel/ISO/Standard)
        const dateObj = new Date(dateStrClean);
        if (!isNaN(dateObj.getTime())) {
            return dateObj;
        }

        return null;
    };

    const processExcel = (file) => {
        statusText.style.display = 'block';
        statusText.textContent = `Analizando Excel: "${file.name}"...`;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawData = XLSX.utils.sheet_to_json(firstSheet);
                const jsonData = rawData.map(row => {
                    const newRow = {};
                    Object.keys(row).forEach(key => { newRow[key.trim()] = row[key]; });
                    return newRow;
                });
                runIntelligence(jsonData);
                statusText.textContent = "¡Análisis estratégico completado!";
                setTimeout(() => {
                    importModal.style.display = 'none';
                    statusText.style.display = 'none';
                }, 1500);
            } catch (error) {
                statusText.textContent = "Error al procesar el Excel.";
                statusText.style.color = "#ff4d4d";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const runIntelligence = (data) => {
        if (!data || data.length === 0) return;

        const findVal = (row, ...keys) => {
            const rowKeys = Object.keys(row);
            for (const key of keys) {
                const match = rowKeys.find(k => k.toLowerCase().includes(key.toLowerCase()));
                if (match) return row[match];
            }
            return null;
        };

        const getReachBase = (reachStr) => {
            if (!reachStr) return 1000;
            const clean = String(reachStr).toLowerCase();
            if (clean.includes('k')) return (parseFloat(clean.replace('k', '')) || 1) * 1000;
            if (clean.includes('m')) return (parseFloat(clean.replace('m', '')) || 1) * 1000000;
            const match = clean.match(/(\d+)/);
            return match ? parseInt(match[1]) : 1000;
        };

        const cutoffDate = new Date(2025, 9, 1);
        const now = new Date();

        const analyzedAds = data.map(row => {
            const dateValue = findVal(row, 'Tiempo Circulación', 'tiempo', 'fecha');
            const startDate = parseMetaDate(dateValue);

            let longevity = 1;
            if (startDate) {
                longevity = Math.max(1, Math.floor((now - startDate) / (1000 * 60 * 60 * 24)));
            } else {
                longevity = 7;
            }

            if (startDate && startDate < cutoffDate) return null;

            let variants = 1;
            const vRaw = findVal(row, 'Cantidad de Anuncios', 'cantidad', 'variantes');
            if (vRaw && !isNaN(parseInt(vRaw))) variants = parseInt(vRaw);

            // Inferencia de impacto real
            const reachBase = getReachBase(findVal(row, 'Alcance_Estimado', 'alcance'));
            const region = String(findVal(row, 'Región', 'pais', 'region') || '').toLowerCase();

            // Lógica de sospecha Regional (Anti-Vistas Artificiales)
            let multiplier = 1;
            if (region.includes('china') || region.includes('vn') || region.includes('ru')) {
                multiplier = 0.05; // Solo contamos el 5% del impacto si la región no encaja con el negocio local
            }

            // Una fórmula más realista: el tiempo mejora la estimación pero no la infla a millones sin sentido.
            // Crecimiento del 5% diario sobre la base, con un tope de 10 veces la base original.
            const realisticMultiplier = 1 + (longevity * 0.05);
            const inferredReach = Math.min(reachBase * 10, Math.floor(reachBase * realisticMultiplier * multiplier));
            const trustScore = Math.min(100, (longevity * 0.4) + (variants * 7) + (Math.log10(inferredReach + 1) * 2));

            return {
                row: {
                    'Anunciante': findVal(row, 'Anunciante', 'nt', 'nombre') || 'Anunciante',
                    'Descripción': findVal(row, 'Descripción', 'desc', 'texto') || 'Sin descripción',
                    'Videos': findVal(row, 'Videos', 'video', 'url', 'media') || 'N/A',
                    'pfp': findVal(row, 'pfp', 'perfil', 'avatar') || 'N/A',
                    ...row
                },
                processed: { longevity, variants, trustScore, startDate, inferredReach }
            };
        }).filter(ad => ad !== null);

        if (analyzedAds.length === 0) {
            statusText.textContent = "No se encontraron datos procesables.";
            statusText.style.color = "#fbbc05";
        } else {
            updateDashboardUI(analyzedAds);
        }
    };

    const updateDashboardUI = (ads) => {
        if (!ads || ads.length === 0) {
            document.getElementById('meta-trust-score').textContent = '0.0';
            document.getElementById('meta-inferred-reach').textContent = '0';
            document.getElementById('meta-investment-scale').textContent = 'Nivel --';
            updateCharts([]);
            renderAdMockups([]);
            return;
        }

        const avgTrust = ads.reduce((acc, ad) => acc + ad.processed.trustScore, 0) / ads.length;
        const totalInferred = ads.reduce((acc, ad) => acc + ad.processed.inferredReach, 0);

        document.getElementById('meta-trust-score').textContent = `${avgTrust.toFixed(1)}/100`;

        let reachDisplay = '';
        if (totalInferred >= 1000000) reachDisplay = (totalInferred / 1000000).toFixed(1) + 'M';
        else if (totalInferred >= 1000) reachDisplay = (totalInferred / 1000).toFixed(0) + 'k';
        else reachDisplay = totalInferred;

        document.getElementById('meta-inferred-reach').textContent = `+${reachDisplay} Est.`;
        document.getElementById('meta-investment-scale').textContent = ads.length > 15 ? 'Agresivo' : (ads.length > 5 ? 'Estable' : 'Creciente');
        updateCharts(ads);
        renderAdMockups(ads);

        // Guardar automáticamente en SQL (Neru Sync)
        axios.post('/system/data/commit', { ads }).catch(e => console.error("Sync error"));
    };

    const renderAdMockups = (ads) => {
        const container = document.getElementById('fb-ad-container');
        if (!container) return;

        container.innerHTML = '';

        const winners = ads.sort((a, b) => b.processed.trustScore - a.processed.trustScore).slice(0, 6);

        winners.forEach(ad => {
            const row = ad.row;
            const name = row['Anunciante'] || 'Anunciante';
            const desc = row['Descripción'] || 'Sin descripción disponible.';
            const mediaUrl = row['Videos'] || '';
            const pfpUrl = (row['pfp'] && row['pfp'] !== 'N/A') ? row['pfp'] : 'https://i.imgur.com/8K9mS9E.png';
            const isVideo = row['Videos'] && String(row['Videos']).includes('.mp4');

            const adCard = document.createElement('div');
            adCard.className = 'fb-ad-card';

            let mediaHtml = '';
            if (mediaUrl && mediaUrl !== 'N/A') {
                if (isVideo) {
                    mediaHtml = `<video controls style="width:100%;"><source src="${mediaUrl}" type="video/mp4"></video>`;
                } else {
                    mediaHtml = `<img src="${mediaUrl}" style="width:100%;">`;
                }
            } else {
                mediaHtml = `<div style="padding: 40px; color: #888; text-align: center;">Media no disponible</div>`;
            }

            adCard.innerHTML = `
                <div class="fb-ad-header">
                    <img class="fb-ad-pfp" src="${pfpUrl}">
                    <div class="fb-ad-header-info">
                        <span class="fb-ad-name">${name}</span>
                        <span class="fb-ad-sub">Publicidad · 🌐</span>
                    </div>
                </div>
                <div class="fb-ad-desc">${desc}</div>
                <div class="fb-ad-media">${mediaHtml}</div>
                <div class="fb-ad-footer">
                    <div class="fb-ad-footer-info">
                        <span class="fb-ad-footer-sub">ANUNCIO ACTIVO</span>
                        <span class="fb-ad-footer-title">${name} - Ver más</span>
                    </div>
                    <button class="fb-ad-cta">Detalles</button>
                </div>
            `;
            container.appendChild(adCard);
        });
    };

    const updateCharts = (ads) => {
        const topAds = ads.sort((a, b) => b.processed.longevity - a.processed.longevity).slice(0, 5);
        const mainCtx = document.getElementById('mainChart')?.getContext('2d');
        if (mainCtx) {
            if (chartInstances.main) chartInstances.main.destroy();
            chartInstances.main = new Chart(mainCtx, {
                type: 'bar',
                data: {
                    labels: topAds.length > 0 ? topAds.map(ad => (ad.row['Anunciante'] || 'Anónimo').substring(0, 15)) : ['Sin datos'],
                    datasets: [{ label: 'Días Activo', data: topAds.length > 0 ? topAds.map(ad => ad.processed.longevity) : [0], backgroundColor: '#00df82', borderRadius: 8 }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        const types = ads.reduce((acc, ad) => {
            const type = ad.row['Tipo_Post'] || 'Video/Imagen';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        const metaCtx = document.getElementById('metaChart')?.getContext('2d');
        if (metaCtx) {
            const chartCard = document.getElementById('metaChart').closest('.chart-card');

            if (ads.length === 0) {
                if (chartInstances.meta) chartInstances.meta.destroy();
                chartCard.style.opacity = '0.3';
                chartCard.style.pointerEvents = 'none';
                return;
            }

            chartCard.style.opacity = '1';
            chartCard.style.pointerEvents = 'auto';

            if (chartInstances.meta) chartInstances.meta.destroy();
            chartInstances.meta = new Chart(metaCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(types),
                    datasets: [{ data: Object.values(types), backgroundColor: ['#00df82', '#1877f2', '#ff4d4d', '#fbbc05', '#94a3b8'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    };

    updateCharts([]);

     // --- MASTER MODAL CONTROLLER (Unifica Dashboard, Manual, Parches y Preview) ---
    const modals = {
        import: { el: document.getElementById('import-modal'), open: document.getElementById('open-import'), close: document.getElementById('close-modal') },
        manual: { el: document.getElementById('manual-modal'), open: document.getElementById('open-manual'), close: document.getElementById('close-manual') },
        patch: { el: document.getElementById('patch-notes-modal'), open: document.querySelector('.ver'), close: document.getElementById('close-patch-notes') },
        preview: { el: document.getElementById('image-preview-modal'), close: document.getElementById('close-image-preview') }
    };

    const toggleModal = (modalKey, show = true) => {
        const modal = modals[modalKey];
        if (modal && modal.el) {
            modal.el.style.display = show ? 'flex' : 'none';
            // Lógica específica para reinicio de pasos si es el manual
            if (modalKey === 'manual' && show) { currentManualStep = 1; updateManualSteps(); }
        }
    };

    // Asignación sistemática de Listeners
    Object.keys(modals).forEach(key => {
        const m = modals[key];
        m.open?.addEventListener('click', () => toggleModal(key, true));
        m.close?.addEventListener('click', () => toggleModal(key, false));
    });

    // Cierre global al hacer click fuera de cualquier modal
    window.addEventListener('click', (e) => {
        Object.keys(modals).forEach(key => {
            if (e.target === modals[key].el) toggleModal(key, false);
        });
    });

    // --- LÓGICA INTERNA DE PASOS (MANUAL) ---
    let currentManualStep = 1;
    const totalSteps = 4;
    const nextBtn = document.getElementById('manual-btn-next');
    const prevBtn = document.getElementById('manual-btn-prev');
    const stepDisplay = document.getElementById('current-step-display');

    function updateManualSteps() {
        document.querySelectorAll('.manual-step').forEach((s, i) => {
            s.style.display = (i + 1 === currentManualStep) ? 'block' : 'none';
        });
        if (stepDisplay) stepDisplay.textContent = currentManualStep;
        if (prevBtn) prevBtn.style.visibility = (currentManualStep === 1) ? 'hidden' : 'visible';
        if (nextBtn) nextBtn.textContent = (currentManualStep === totalSteps) ? '¡Entendido! Cerrar' : 'Siguiente →';
    }

    nextBtn?.addEventListener('click', () => {
        if (currentManualStep < totalSteps) { currentManualStep++; updateManualSteps(); }
        else toggleModal('manual', false);
    });

    prevBtn?.addEventListener('click', () => {
        if (currentManualStep > 1) { currentManualStep--; updateManualSteps(); }
    });

    // --- LÓGICA DE VISTA PREVIA DE IMÁGENES ---
    document.querySelectorAll('.previewable-img').forEach(img => {
        img.addEventListener('click', () => {
            const previewContent = document.getElementById('preview-img-content');
            if (previewContent) {
                previewContent.src = img.src;
                toggleModal('preview', true);
            }
        });
    });
});
