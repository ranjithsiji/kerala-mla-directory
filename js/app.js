let map = null;

$(document).ready(function () {
    init();

    async function init() {
        showLoader(true);
        await loadDistricts();
        showLoader(false);

        // Check for qid in URL
        const urlParams = new URLSearchParams(window.location.search);
        const qid = urlParams.get('qid');
        if (qid) {
            const constituencyId = `http://www.wikidata.org/entity/${qid}`;
            showLoader(true);
            await loadMLADetails(constituencyId, "Loading...");
            showLoader(false);
        }

        $('#districtSelect').on('change', async function () {
            const districtId = $(this).val();
            if (districtId) {
                showLoader(true);
                await loadConstituencies(districtId);
                showLoader(false);
            } else {
                $('#constituencySelect').prop('disabled', true).html('<option value="">Select Constituency</option>');
            }
        });

        $('#loadProfileBtn').on('click', async function () {
            const constituencyId = $('#constituencySelect').val();
            const constituencyLabel = $("#constituencySelect option:selected").text();
            if (constituencyId) {
                showLoader(true);
                await loadMLADetails(constituencyId, constituencyLabel);
                showLoader(false);
            } else {
                alert("Please select a constituency first.");
            }
        });

        // Theme Toggle
        const currentTheme = localStorage.getItem('theme') || 'light';
        $('body').attr('data-theme', currentTheme);
        updateThemeIcon(currentTheme);

        $('#themeToggle').on('click', function () {
            const theme = $('body').attr('data-theme') === 'dark' ? 'light' : 'dark';
            $('body').attr('data-theme', theme);
            localStorage.setItem('theme', theme);
            updateThemeIcon(theme);
        });
    }

    function updateThemeIcon(theme) {
        const $icon = $('#themeToggle i');
        if (theme === 'dark') {
            $icon.removeClass('fa-moon').addClass('fa-sun');
            $('#themeToggle').removeClass('text-dark').addClass('text-light');
        } else {
            $icon.removeClass('fa-sun').addClass('fa-moon');
            $('#themeToggle').removeClass('text-light').addClass('text-dark');
        }
    }

    function showLoader(show) {
        if (show) {
            $('#loader').addClass('active');
        } else {
            $('#loader').removeClass('active');
        }
    }

    async function loadDistricts() {
        const data = await WikiAPI.getDistricts();
        if (data && data.results.bindings) {
            const $select = $('#districtSelect');
            data.results.bindings.forEach(item => {
                $select.append(`<option value="${item.item.value}">${item.itemLabel.value}</option>`);
            });
        }
    }

    async function loadConstituencies(districtId) {
        const data = await WikiAPI.getConstituencies(districtId);
        const $select = $('#constituencySelect');
        $select.prop('disabled', false).html('<option value="">Select Constituency</option>');

        if (data && data.results.bindings) {
            data.results.bindings.forEach(item => {
                $select.append(`<option value="${item.item.value}">${item.itemLabel.value}</option>`);
            });
        }
    }

    async function loadMLADetails(constituencyId, constituencyLabel) {
        const mlaData = await WikiAPI.getMLA(constituencyId);
        const consData = await WikiAPI.getConstituencyDetails(constituencyId);

        if (mlaData && mlaData.results.bindings.length > 0) {
            const mla = mlaData.results.bindings[0];
            const cons = consData && consData.results.bindings.length > 0 ? consData.results.bindings[0] : null;

            // Update UI
            const finalLabel = (constituencyLabel === "Loading..." && cons) ? cons.itemLabel.value : constituencyLabel;
            $('#constituencyTitle').text(finalLabel === "Loading..." ? "MLA Profile" : finalLabel);
            $('#mlaName').text(mla.mlaLabel.value);
            $('#mlaParty').text(mla.partyLabel ? mla.partyLabel.value : 'N/A');
            $('#mlaConstituency').text(finalLabel === "Loading..." ? "Constituency" : finalLabel);

            // Detailed MLA Info
            function calculateAge(dob) {
                const birthDate = new Date(dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                return age;
            }

            const fields = [
                { id: 'mlaDob', row: 'mlaDobRow', value: mla.dob ? `${new Date(mla.dob.value).toLocaleDateString()} (Age: ${calculateAge(mla.dob.value)})` : null },
                { id: 'mlaPob', row: 'mlaPobRow', value: mla.pobLabel ? mla.pobLabel.value : null },
                { id: 'mlaOccupation', row: 'mlaOccupationRow', value: mla.occupationLabel ? mla.occupationLabel.value : null },
                { id: 'mlaEducation', row: 'mlaEducationRow', value: mla.educationLabel ? mla.educationLabel.value : null },
                { id: 'mlaLanguages', row: 'mlaLanguagesRow', value: mla.languages ? mla.languages.value : (mla.nativeLangLabel ? mla.nativeLangLabel.value : null) },
                { id: 'mlaDegree', row: 'mlaDegreeRow', value: mla.degrees ? mla.degrees.value : null },
                { id: 'mlaResidence', row: 'mlaResidenceRow', value: mla.residenceLabel ? mla.residenceLabel.value : null }
            ];

            fields.forEach(f => {
                const $row = $(`#${f.row}`);
                const $val = $(`#${f.id}`);
                if (f.value) {
                    $val.text(f.value);
                    $row.removeClass('d-none');
                } else {
                    $row.addClass('d-none');
                }
            });

            const imageUrl = mla.image ? WikiAPI.getThumbnailUrl(mla.image.value) : 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png';
            $('#mlaImage').attr('src', imageUrl).removeClass('mla-placeholder');

            // Set up data for popups
            const popupMap = {
                'mla-wikipedia': mla.wikipedia ? mla.wikipedia.value.replace('en.wikipedia.org', 'en.m.wikipedia.org') : null,
                'mla-wikidata': mla.mla.value,
                'cons-wikipedia': cons && cons.wikipedia ? cons.wikipedia.value.replace('en.wikipedia.org', 'en.m.wikipedia.org') : null,
                'cons-wikidata': constituencyId
            };

            $(document).off('click', '.btn-wiki-popup').on('click', '.btn-wiki-popup', async function () {
                let url = $(this).data('url');
                const type = $(this).data('type');
                if (!url && type) url = popupMap[type];

                if (!url) {
                    alert("Information not available.");
                    return;
                }

                $('#modalTitle').text('');
                $('#modalBodyText').empty();
                $('#modalLoader').removeClass('d-none');
                $('#modalInfoContent').addClass('d-none');
                $('#infoModal').modal('show');

                try {
                    if (url.includes('wikipedia.org')) {
                        const lang = url.includes('ml.wikipedia.org') ? 'ml' : 'en';
                        const title = decodeURIComponent(url.split('/wiki/').pop());
                        const data = await WikiAPI.getWikipediaFullHTML(lang, title);
                        if (data) {
                            const externalUrl = `https://${lang}.wikipedia.org/wiki/${title}`;
                            $('#modalTitle').html(`${data.title} <a href="${externalUrl}" target="_blank" class="ms-2 fs-6 text-muted" title="View on Wikipedia"><i class="fas fa-external-link-alt"></i></a>`);
                            $('#modalBodyText').html(data.text);
                            // Fix links to open in new tab within the injected HTML
                            $('#modalBodyText a').attr('target', '_blank');
                        }
                    } else if (url.includes('wikidata.org')) {
                        const qid = url.split('/').pop().split('#')[0];
                        const html = await WikiAPI.getWikidataFullHTML(qid);
                        if (html) {
                            renderWikidata(qid, html);
                        }
                    }
                } catch (e) {
                    $('#modalBodyText').text('Error loading content.');
                } finally {
                    $('#modalLoader').addClass('d-none');
                    $('#modalInfoContent').removeClass('d-none');
                }
            });

            async function renderWikidata(qid, html) {
                const externalUrl = `https://www.wikidata.org/wiki/${qid}`;
                $('#modalTitle').html(`${qid} <a href="${externalUrl}" target="_blank" class="ms-2 fs-6 text-muted" title="View on Wikidata"><i class="fas fa-external-link-alt"></i></a>`);
                $('#modalBodyText').html(html);

                // Intercept links to keep them in the modal
                $('#modalBodyText a').each(function () {
                    let href = $(this).attr('href');
                    if (href) {
                        // Check for Wikidata entity links
                        if (href.startsWith('/wiki/Q') || href.startsWith('/wiki/P') || href.includes('wikidata.org/wiki/Q') || href.includes('wikidata.org/wiki/P')) {
                            const newQid = href.split('/').pop().split('#')[0];
                            $(this).attr('href', 'javascript:void(0)');
                            $(this).on('click', function (e) {
                                e.preventDefault();
                                loadEntityInModal(newQid);
                            });
                        } else {
                            $(this).attr('target', '_blank');
                        }
                    }
                });
            }

            async function loadEntityInModal(qid) {
                $('#modalLoader').removeClass('d-none');
                $('#modalInfoContent').addClass('d-none');

                try {
                    const html = await WikiAPI.getWikidataFullHTML(qid);
                    if (html) {
                        renderWikidata(qid, html);
                    }
                } catch (e) {
                    $('#modalBodyText').text('Error loading entity.');
                } finally {
                    $('#modalLoader').addClass('d-none');
                    $('#modalInfoContent').removeClass('d-none');
                }
            }

            $('#infoModal').on('hidden.bs.modal', function () {
                $('#infoFrame').attr('src', '');
            });

            $('#wikidataLink').attr('href', mla.mla.value);
            $('#mlaWikidataLinkMini').attr('href', mla.mla.value);

            // MLA Wikipedia
            if (mla.wikipedia) {
                const wikiTitle = decodeURIComponent(mla.wikipedia.value.split('/wiki/').pop());
                $('#mlaWikiLinkMini').attr('href', mla.wikipedia.value).show();

                const summary = await WikiAPI.getWikipediaSummary(wikiTitle);
                if (summary) {
                    $('#mlaDescription').html(`<p>${summary.extract_html || summary.extract}</p>`);
                } else {
                    $('#mlaDescription').text('No description available from Wikipedia.');
                }
            } else {
                $('#mlaWikiLinkMini').hide();
                $('#mlaDescription').text('No Wikipedia link found for this representative.');
            }

            // Constituency Details Box
            if (cons) {
                const consFields = [
                    { id: 'consDistrict', row: 'consDistrictRow', value: cons.districtLabel ? cons.districtLabel.value : null },
                    { id: 'consInception', row: 'consInceptionRow', value: cons.inception ? new Date(cons.inception.value).getFullYear() : null },
                    { id: 'consArea', row: 'consAreaRow', value: cons.area ? `${parseFloat(cons.area.value).toLocaleString()} km²` : null }
                ];

                consFields.forEach(f => {
                    const $row = $(`#${f.row}`);
                    const $val = $(`#${f.id}`);
                    if (f.value) {
                        $val.text(f.value);
                        $row.removeClass('d-none');
                    } else {
                        $row.addClass('d-none');
                    }
                });

                $('#consWikidataLink').attr('href', constituencyId);
                $('#consWikidataLinkMini').attr('href', constituencyId);

                if (cons.wikipedia) {
                    const consWiki = cons.wikipedia.value;
                    $('#consWikiLink').attr('href', consWiki).show();
                    $('#consWikiLinkMini').attr('href', consWiki).show();
                    const consTitle = decodeURIComponent(consWiki.split('/wiki/').pop());
                    const consSummary = await WikiAPI.getWikipediaSummary(consTitle);
                    if (consSummary) {
                        $('#constituencyDescription').html(`<p>${consSummary.extract_html || consSummary.extract}</p>`);
                    } else {
                        $('#constituencyDescription').text('No constituency summary available.');
                    }
                } else {
                    $('#consWikiLink').hide();
                    $('#consWikiLinkMini').hide();
                    $('#constituencyDescription').text('No Wikipedia entry found for this constituency.');
                }
            }

            // Toggle view
            $('#welcomeMessage').addClass('d-none');
            $('#mlaProfile').removeClass('d-none').addClass('animate-up');

            // Administrative Divisions (Panchayats)
            await loadPanchayats(constituencyId);

            // Constituency Map (Assembled Geoshapes)
            try {
                await initMap(constituencyId);
            } catch (e) {
                console.error("Map initialization failed", e);
            }

            // Constituency Gallery
            let gallerySearch = (constituencyLabel === "Loading..." && cons) ? cons.itemLabel.value : constituencyLabel;
            // Strip common suffixes for better image search results
            gallerySearch = gallerySearch.replace(/ State Assembly constituency/g, '').replace(/ (constituency|assembly|kerala)/gi, '');
            await loadGallery(gallerySearch);

            // Scroll to profile if not already there
            if (window.scrollY < 200) {
                $('html, body').animate({
                    scrollTop: $("#mlaProfile").offset().top - 100
                }, 500);
            }

        } else {
            alert('MLA details not found for this constituency in the 15th Assembly.');
        }
    }

    async function initMap(constituencyId) {
        if (!map) {
            map = L.map('map').setView([10.5, 76.5], 7);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
        } else {
            map.eachLayer((layer) => {
                if (layer instanceof L.GeoJSON || (layer instanceof L.TileLayer && !layer._url.includes('openstreetmap'))) {
                    map.removeLayer(layer);
                }
            });
        }

        const geoData = await WikiAPI.getConstituencyGeoshapes(constituencyId);
        if (geoData && geoData.results.bindings.length > 0) {
            const layers = L.featureGroup().addTo(map);

            for (const item of geoData.results.bindings) {
                const geoshapeUrl = item.geoshape.value;
                const geojson = await WikiAPI.getGeojson(geoshapeUrl);
                if (geojson) {
                    L.geoJSON(geojson, {
                        style: {
                            color: '#0062ff',
                            weight: 2,
                            fillColor: '#0062ff',
                            fillOpacity: 0.2
                        }
                    }).bindPopup(item.itemLabel.value).addTo(layers);
                }
            }
            if (layers.getLayers().length > 0) {
                map.fitBounds(layers.getBounds(), { padding: [20, 20] });
            }
        }
    }

    async function loadGallery(label) {
        const $gallery = $('#constituencyGallery');
        $gallery.empty();

        // Try getting images from Wikimedia Commons
        const images = await WikiAPI.getConstituencyImages(label);
        if (images && images.length > 0) {
            images.slice(0, 6).forEach(url => {
                const thumbUrl = WikiAPI.getThumbnailUrl(url, 400);
                $gallery.append(`
                    <div class="col-md-4">
                        <img src="${thumbUrl}" class="gallery-img" alt="${label}">
                    </div>
                `);
            });
        } else {
            $gallery.append('<p class="text-muted ps-2">No gallery images found for this constituency.</p>');
        }
    }

    async function loadPanchayats(constituencyId) {
        const $section = $('#panchayatSection');
        const $list = $('#panchayatList');
        $list.empty();
        $section.addClass('d-none');

        try {
            const data = await WikiAPI.getConstituencyGeoshapes(constituencyId);
            if (data && data.results.bindings.length > 0) {
                data.results.bindings.forEach(binding => {
                    const name = binding.itemLabel.value;
                    const wikidataUrl = binding.item.value;
                    const wikipediaUrl = binding.wikipedia ? binding.wikipedia.value : (binding.wikipediaML ? binding.wikipediaML.value : null);
                    const isML = !binding.wikipedia && binding.wikipediaML;

                    const row = $(`
                        <div class="panchayat-row d-flex align-items-center justify-content-between p-2 mb-2 rounded border glass-card shadow-sm w-100">
                            <span class="fw-bold">${name}</span>
                            <div class="d-flex gap-2">
                                ${wikipediaUrl ? `
                                <button class="btn btn-sm ${isML ? 'btn-outline-success' : 'btn-outline-primary'} btn-wiki-popup" data-url="${wikipediaUrl}" title="${isML ? 'Malayalam Wikipedia' : 'Wikipedia'}">
                                    <i class="fab fa-wikipedia-w"></i>${isML ? '<span class="ms-1 small">ML</span>' : ''}
                                </button>` : ''}
                                <button class="btn btn-sm btn-outline-info btn-wiki-popup" data-url="${wikidataUrl}" title="Wikidata">
                                    <i class="fas fa-database"></i>
                                </button>
                            </div>
                        </div>
                    `);
                    $list.append(row);
                });
                $section.removeClass('d-none').addClass('animate-up');
            }
        } catch (e) {
            console.error("Failed to load panchayats", e);
        }
    }
});
