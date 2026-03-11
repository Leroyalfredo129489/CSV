document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN DE SERVIDOR ---
    const SERVER_URL = '/upload';
    let selectedFileN8n = null;
    let currentMediaUrls = []; // Almacén de URLs de la sesión actual

    // --- CONFIGURACIÓN ESTRATÉGICA (AJUSTABLE POR EL CLIENTE/DEV) ---
    const STRATEGY_CONFIG = {
        WEIGHT_LONGEVITY_BASE: 1.5,
        WEIGHT_LONGEVITY_MULTIPLIER: 2,
        WEIGHT_VARIANT_BONUS: 0.15,
        SCORE_MULTIPLIER: 5,
        REACH_DEFAULT: 1000,
        REACH_GROWTH_RATE: 0.02
    };

    // --- CONTEXTO DE UI Y NAVEGACIÓN ---
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
                Object.values(chartInstances).forEach(chart => {
                    if (chart && typeof chart.resize === 'function') chart.resize();
                });
            }

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

    // --- LÓGICA DE LIMPIEZA n8n (Subida CSV) ---
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

            setTimeout(() => {
                selectedFileN8n = null;
                if (fileInputN8n) fileInputN8n.value = '';
                if (fileNameN8n) fileNameN8n.innerHTML = '<strong>Haz clic</strong> o arrastra el CSV aquí';
                if (convertBtnN8n) convertBtnN8n.style.display = 'none';
                if (statusAreaN8n) statusAreaN8n.style.display = 'none';
            }, 4000);

        } catch (error) {
            loaderN8n.style.display = 'none';
            convertBtnN8n.disabled = false;
            let errorMsg = error.response?.data?.error || error.message;
            statusTextN8n.textContent = errorMsg;
            statusTextN8n.style.color = '#ff4d4d';
        }
    });

    // --- LÓGICA DE INTELIGENCIA EXCEL ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusText = document.getElementById('upload-status');
    const importModal = document.getElementById('import-modal');

    dropZone?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            processExcel(file);
            fileInput.value = '';
        }
    });

    const showStatus = (msg, type = 'info', persistent = false) => {
        if (!statusText) return;
        statusText.style.display = 'block';
        statusText.textContent = msg;
        statusText.style.color = type === 'error' ? '#ff4d4d' : (type === 'warning' ? '#fbbc05' : '#00df82');
        if (!persistent) {
            setTimeout(() => { statusText.style.display = 'none'; }, 4000);
        }
    };

    const parseMetaDate = (dateStr) => {
        if (!dateStr) return null;
        const dateStrClean = String(dateStr).trim().toLowerCase();
        const months = {
            'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
        };

        const regex = /desde\s+el\s+(\d+)\s+([a-z]+)\.?\s+(\d+)/i;
        const match = dateStrClean.match(regex);

        if (match) {
            const d = parseInt(match[1]);
            const mName = match[2].substring(0, 3);
            const m = months[mName];
            const y = parseInt(match[3]);
            if (m !== undefined && !isNaN(d) && !isNaN(y)) return new Date(y, m, d);
        }

        const dateObj = new Date(dateStrClean);
        if (!isNaN(dateObj.getTime())) return dateObj;
        return null;
    };

    const processExcel = (file) => {
        showStatus(`Analizando: "${file.name}"...`, 'info', true);
        const reader = new FileReader();
        reader.onerror = () => showStatus("Error de lectura del archivo físico.", "error");
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                if (!workbook.SheetNames.length) throw new Error("Archivo Excel vacío o corrupto.");
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawData = XLSX.utils.sheet_to_json(firstSheet);
                if (!rawData.length) throw new Error("No se encontraron filas con datos en la hoja.");

                const jsonData = rawData.map(row => {
                    const newRow = {};
                    Object.keys(row).forEach(key => { newRow[key.trim()] = row[key]; });
                    return newRow;
                });
                runIntelligence(jsonData);
            } catch (error) {
                console.error("Critical Analysis Error:", error);
                showStatus(`Fallo Crítico: ${error.message}`, "error", true);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const runIntelligence = (data) => {
        let missingFieldsCount = 0;
        const criticalKeys = ['Tiempo Circulación', 'Alcance_Estimado', 'Anunciante'];

        const findVal = (row, ...keys) => {
            const rowKeys = Object.keys(row);
            for (const key of keys) {
                const match = rowKeys.find(k => k.toLowerCase() === key.toLowerCase() || k.toLowerCase().includes(key.toLowerCase()));
                if (match) return row[match];
            }
            return null;
        };

        const getReachValue = (reachStr) => {
            if (!reachStr || String(reachStr).includes('#NAME?') || String(reachStr).trim() === '') return null;
            const clean = String(reachStr).toLowerCase().replace(/\s/g, '');
            if (clean.includes('-')) {
                const parts = clean.split('-');
                const min = getReachValue(parts[0]) || 500;
                const max = getReachValue(parts[1]) || 1500;
                return (min + max) / 2;
            }
            if (clean.includes('k')) return (parseFloat(clean.replace('k', '')) || 1) * 1000;
            if (clean.includes('m')) return (parseFloat(clean.replace('m', '')) || 1) * 1000000;
            const match = clean.match(/(\d+)/);
            return match ? parseInt(match[1]) : 1000;
        };

        const now = new Date();

        const analyzedAds = data.map(row => {
            criticalKeys.forEach(key => { if (!findVal(row, key)) missingFieldsCount++; });

            const dateValue = findVal(row, 'Tiempo Circulación');
            const startDate = parseMetaDate(dateValue);
            let longevity = 1;
            if (startDate) {
                longevity = Math.max(1, Math.floor((now - startDate) / (1000 * 60 * 60 * 24)));
            }

            const reachVal = getReachValue(findVal(row, 'Alcance_Estimado'));
            const reachEst = reachVal || STRATEGY_CONFIG.REACH_DEFAULT;
            const variants = parseInt(findVal(row, 'Cantidad de Anuncios')) || 1;
            const potentialTag = String(findVal(row, 'Potencial') || '').toUpperCase();

            let finalScore = parseFloat(findVal(row, 'Impresiones/Potencial')) || 0;
            if (finalScore === 0) {
                // FÓRMULA CALIBRADA USANDO OBJETO DE CONFIGURACIÓN
                const fT = Math.log10(longevity + STRATEGY_CONFIG.WEIGHT_LONGEVITY_BASE) * STRATEGY_CONFIG.WEIGHT_LONGEVITY_MULTIPLIER;
                const mV = 1 + (variants * STRATEGY_CONFIG.WEIGHT_VARIANT_BONUS);
                finalScore = (fT * STRATEGY_CONFIG.SCORE_MULTIPLIER) * mV;
            }

            const inferredReach = Math.floor(reachEst * (1 + (longevity * STRATEGY_CONFIG.REACH_GROWTH_RATE)));

            return {
                row: {
                    'Anunciante': findVal(row, 'Anunciante') || 'Anónimo',
                    'Descripción': findVal(row, 'Descripción') || 'Sin descripción',
                    'Videos': findVal(row, 'Videos') || 'N/A',
                    'pfp': findVal(row, 'pfp') || 'N/A',
                    'PotencialTag': potentialTag,
                    ...row
                },
                processed: { longevity, variants, trustScore: finalScore, startDate, inferredReach }
            };
        });

        // RECOLECCIÓN DE MEDIOS PARA EL ARCHIVADOR
        currentMediaUrls = analyzedAds
            .map(ad => ad.row['Videos'])
            .filter(url => url && url !== 'N/A' && (url.includes('http') || url.includes('fbcdn')));

        const downloadBtn = document.getElementById('download-all-media');
        if (downloadBtn) {
            downloadBtn.disabled = currentMediaUrls.length === 0;
            downloadBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Descargar ${currentMediaUrls.length} Medios (.zip)`;
        }

        const totalPossibleCritical = data.length * criticalKeys.length;
        const qualityPercent = Math.round(((totalPossibleCritical - missingFieldsCount) / totalPossibleCritical) * 100);

        if (qualityPercent < 60) {
            showStatus(`⚠️ Calidad Crítica: ${qualityPercent}% de datos válidos.`, 'warning', true);
        } else if (qualityPercent < 85) {
            showStatus(`💡 Análisis completado al ${qualityPercent}%.`, 'info');
        } else {
            showStatus("✅ ¡Análisis estratégico exitoso!", 'info');
        }

        setTimeout(() => {
            if (importModal) importModal.style.display = 'none';
            updateDashboardUI(analyzedAds);
        }, qualityPercent < 60 ? 3000 : 1500);
    };

    const updateDashboardUI = (ads) => {
        const scoreDashEl = document.getElementById('dash-meta-spend');
        if (!ads || ads.length === 0) {
            document.getElementById('meta-trust-score').textContent = '0.0';
            document.getElementById('meta-inferred-reach').textContent = '0';
            document.getElementById('meta-investment-scale').textContent = 'Nivel --';
            if (scoreDashEl) scoreDashEl.textContent = '0/100';
            updateCharts([]);
            renderAdMockups([]);
            return;
        }

        const rawAvg = ads.reduce((acc, ad) => acc + ad.processed.trustScore, 0) / ads.length;
        const displayScore = rawAvg < 15 ? (rawAvg * 10).toFixed(1) : rawAvg.toFixed(1);
        const totalInferred = ads.reduce((acc, ad) => acc + ad.processed.inferredReach, 0);

        const finalScoreText = `${displayScore}/100`;
        document.getElementById('meta-trust-score').textContent = finalScoreText;
        if (scoreDashEl) scoreDashEl.textContent = finalScoreText;

        let reachDisplay = '';
        if (totalInferred >= 1000000) reachDisplay = (totalInferred / 1000000).toFixed(1) + 'M';
        else if (totalInferred >= 1000) reachDisplay = (totalInferred / 1000).toFixed(0) + 'k';
        else reachDisplay = totalInferred;

        document.getElementById('meta-inferred-reach').textContent = `+${reachDisplay} Est.`;

        const tallies = ads.reduce((acc, ad) => {
            const tag = ad.row.PotencialTag || '';
            if (tag.includes('ALTO')) acc.alto++;
            else if (tag.includes('ESTABLE')) acc.estable++;
            else acc.testing++;
            return acc;
        }, { alto: 0, estable: 0, testing: 0 });

        let scaleText = 'Testing';
        if (tallies.alto > 0) scaleText = '🔥 Alto Potencial';
        else if (tallies.estable > tallies.testing) scaleText = '⚡ Estable';

        document.getElementById('meta-investment-scale').textContent = scaleText;
        updateCharts(ads);
        renderAdMockups(ads);

        axios.post('/system/data/commit', { ads }).catch(e => console.error("Sync error"));
    };

    const renderAdMockups = (ads) => {
        const container = document.getElementById('fb-ad-container');
        if (!container) return;
        container.innerHTML = '';

        const winners = ads.sort((a, b) => b.processed.trustScore - a.processed.trustScore).slice(0, 6);

        winners.forEach(ad => {
            const row = ad.row;
            const adId = row['ID'] || '';
            const name = row['Anunciante'] || 'Anunciante';
            const desc = row['Descripción'] || 'Sin descripción disponible.';
            const mediaUrl = row['Videos'] || '';
            const pfpUrl = (row['pfp'] && row['pfp'] !== 'N/A') ? row['pfp'] : 'https://i.imgur.com/8K9mS9E.png';
            const isVideo = row['Videos'] && String(row['Videos']).includes('.mp4');

            const adCard = document.createElement('div');
            adCard.className = 'fb-ad-card';

            let mediaHtml = mediaUrl && mediaUrl !== 'N/A'
                ? (isVideo ? `<video controls style="width:100%;"><source src="${mediaUrl}" type="video/mp4"></video>` : `<img src="${mediaUrl}" style="width:100%;">`)
                : `<div style="padding: 40px; color: #888; text-align: center;">Media no disponible</div>`;

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
                    <button class="fb-ad-cta" ${adId ? `onclick="window.open('https://www.facebook.com/ads/library/?id=${adId}', '_blank')"` : 'disabled'}>
                        Detalles
                    </button>
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
            const chartCard = metaCtx.canvas.closest('.chart-card');
            if (ads.length === 0) {
                if (chartInstances.meta) chartInstances.meta.destroy();
                if (chartCard) {
                    chartCard.style.opacity = '0.3';
                    chartCard.style.pointerEvents = 'none';
                }
                return;
            }
            if (chartCard) {
                chartCard.style.opacity = '1';
                chartCard.style.pointerEvents = 'auto';
            }
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

    // --- CONTROLADOR DE MODALES ---
    const modals = {
        import: { el: document.getElementById('import-modal'), open: document.getElementById('open-import'), close: document.getElementById('close-modal') },
        manual: { el: document.getElementById('manual-modal'), open: document.getElementById('open-manual'), close: document.getElementById('close-manual') },
        patch: { el: document.getElementById('patch-notes-modal'), open: document.querySelector('.ver'), close: document.getElementById('close-patch-notes') },
        preview: { el: document.getElementById('image-preview-modal'), close: document.getElementById('close-image-preview') },
        compliance: { el: document.getElementById('compliance-modal'), open: document.getElementById('open-compliance'), close: document.getElementById('close-compliance-modal') }
    };

    const toggleModal = (modalKey, show = true) => {
        const modal = modals[modalKey];
        if (modal && modal.el) {
            modal.el.style.display = show ? 'flex' : 'none';
            if (modalKey === 'manual' && show) { currentManualStep = 1; updateManualSteps(); }
        }
    };

    Object.keys(modals).forEach(key => {
        const m = modals[key];
        m.open?.addEventListener('click', () => toggleModal(key, true));
        m.close?.addEventListener('click', () => toggleModal(key, false));
    });

    window.addEventListener('click', (e) => {
        Object.keys(modals).forEach(key => {
            if (e.target === modals[key].el) toggleModal(key, false);
        });
    });

    // --- NAVEGACIÓN MANUAL (PASOS) ---
    let currentManualStep = 1;
    const totalSteps = 5;
    const nextBtn = document.getElementById('manual-btn-next');
    const prevBtn = document.getElementById('manual-btn-prev');
    const stepDisplay = document.getElementById('current-step-display');
    const progressBar = document.getElementById('manual-progress');

    function updateManualSteps() {
        document.querySelectorAll('.manual-step').forEach((s, i) => {
            s.style.display = (i + 1 === currentManualStep) ? 'block' : 'none';
        });
        if (stepDisplay) stepDisplay.textContent = currentManualStep;
        if (progressBar) progressBar.style.width = `${(currentManualStep / totalSteps) * 100}%`;
        if (prevBtn) prevBtn.style.visibility = (currentManualStep === 1) ? 'hidden' : 'visible';
        if (nextBtn) nextBtn.textContent = (currentManualStep === totalSteps) ? '¡Entendido! Finalizar' : 'Siguiente →';
    }

    nextBtn?.addEventListener('click', () => {
        if (currentManualStep < totalSteps) { currentManualStep++; updateManualSteps(); }
        else toggleModal('manual', false);
    });

    prevBtn?.addEventListener('click', () => {
        if (currentManualStep > 1) { currentManualStep--; updateManualSteps(); }
    });


    // --- VISTA PREVIA DE IMÁGENES ---
    document.querySelectorAll('.previewable-img').forEach(img => {
        img.addEventListener('click', () => {
            const previewContent = document.getElementById('preview-img-content');
            if (previewContent) {
                previewContent.src = img.src;
                toggleModal('preview', true);
            }
        });
    });
    // --- LÓGICA DE DESCARGA MASIVA (ARCHIVADOR) ---
    const downloadMediaBtn = document.getElementById('download-all-media');
    downloadMediaBtn?.addEventListener('click', async () => {
        if (currentMediaUrls.length === 0) return;

        downloadMediaBtn.disabled = true;
        downloadMediaBtn.textContent = '📦 Preparando ZIP...';

        try {
            const response = await axios.post('/system/media/archive', { mediaUrls: currentMediaUrls }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `anuncios_media_${Date.now()}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showStatus("✅ ¡Descarga masiva completada!", "info");
        } catch (error) {
            console.error("Archive Error:", error);
            showStatus("❌ Error al crear el archivo de medios.", "error");
        } finally {
            downloadMediaBtn.disabled = false;
            downloadMediaBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Descargar ${currentMediaUrls.length} Medios (.zip)`;
        }
    });
});
