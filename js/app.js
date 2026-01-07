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
            await loadMLADetails(constituencyId, "Loading Profile...");
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
            $('#constituencyTitle').text(constituencyLabel === "Loading..." ? (cons ? "MLA Profile" : "Representative Profile") : constituencyLabel);
            $('#mlaName').text(mla.mlaLabel.value);
            $('#mlaParty').text(mla.partyLabel ? mla.partyLabel.value : 'N/A');
            $('#mlaConstituency').text(constituencyLabel === "Loading..." ? "Constituency" : constituencyLabel);

            // Detailed MLA Info
            const fields = [
                { id: 'mlaDob', row: 'mlaDobRow', value: mla.dob ? new Date(mla.dob.value).toLocaleDateString() : null },
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

            $('.btn-wiki-popup').off('click').on('click', function () {
                const type = $(this).data('type');
                const url = popupMap[type];
                if (url) {
                    $('#infoFrame').attr('src', url);
                    $('#infoModal').modal('show');
                } else {
                    alert("Information not available.");
                }
            });

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

            // Constituency Map (Assembled Geoshapes)
            try {
                // await initMap(constituencyId); 
                // User asked not to load map part for now
            } catch (e) {
                console.error("Map initialization failed", e);
            }

            // Constituency Gallery
            const gallerySearch = (constituencyLabel === "Loading..." && cons) ? cons.itemLabel.value : constituencyLabel;
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
                if (geojson && geojson.data) {
                    L.geoJSON(geojson.data, {
                        style: {
                            color: '#0062ff',
                            weight: 2,
                            fillOpacity: 0.3
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
});
