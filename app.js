// Kerala districts and their constituencies
const KERALA_DATA = {
    "Thiruvananthapuram": ["Kazhakoottam", "Vattiyoorkavu", "Thiruvananthapuram", "Nemom", "Aruvikkara", "Parassala", "Kovalam", "Neyyattinkara"],
    "Kollam": ["Chavara", "Kunnathur", "Kollam", "Eravipuram", "Chathannoor", "Kundara", "Kottarakkara", "Pathanapuram", "Punalur", "Chadayamangalam"],
    "Pathanamthitta": ["Adoor", "Konni", "Ranni", "Aranmula", "Thiruvalla"],
    "Alappuzha": ["Kayamkulam", "Haripad", "Alappuzha", "Ambalappuzha", "Kuttanad", "Chengannur", "Mavelikkara", "Cherthala", "Aroor"],
    "Kottayam": ["Pala", "Kaduthuruthy", "Vaikom", "Ettumanoor", "Kottayam", "Puthuppally", "Changanassery", "Kanjirappally", "Poonjar"],
    "Idukki": ["Devikulam", "Udumbanchola", "Thodupuzha", "Idukki", "Peerumade"],
    "Ernakulam": ["Perumbavoor", "Angamaly", "Aluva", "Kalamassery", "Paravur", "Vypen", "Kochi", "Thrippunithura", "Ernakulam", "Thrikkakara", "Kunnathunad", "Piravom", "Muvattupuzha", "Kothamangalam"],
    "Thrissur": ["Chalakudy", "Kodungallur", "Thrissur", "Ollur", "Guruvayur", "Manalur", "Wadakkanchery", "Irinjalakuda", "Puthukkad", "Chelakkara", "Kunnamkulam", "Chavakkad", "Nattika"],
    "Palakkad": ["Alathur", "Chittur", "Nemmara", "Palakkad", "Tarur", "Pattambi", "Thrithala", "Shornur", "Ottapalam", "Kongad", "Malampuzha"],
    "Malappuram": ["Mankada", "Malappuram", "Vengara", "Vallikkunnu", "Tirurangadi", "Tanur", "Tirur", "Kottakkal", "Thavanur", "Ponnani", "Thrithala", "Perinthalmanna", "Manjeri", "Wandoor", "Nilambur", "Kondotty"],
    "Kozhikode": ["Vadakara", "Kuttiadi", "Nadapuram", "Quilandy", "Perambra", "Balusseri", "Elathur", "Kozhikode North", "Kozhikode South", "Beypore", "Kunnamangalam", "Koduvally", "Thiruvambady"],
    "Wayanad": ["Mananthavady", "Sulthan Bathery", "Kalpetta"],
    "Kannur": ["Thalassery", "Kuthuparamba", "Mattannur", "Peravoor", "Kannur", "Azhikode", "Dharmadam", "Taliparamba", "Irikkur", "Payyannur", "Kalliasseri"],
    "Kasaragod": ["Manjeshwaram", "Kasaragod", "Udma", "Kanhangad", "Trikaripur"]
};

let currentData = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    populateDistricts();
    setupEventListeners();
});

function populateDistricts() {
    const districtSelect = document.getElementById('district');
    const districts = Object.keys(KERALA_DATA).sort();
    
    districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
    });
}

function setupEventListeners() {
    const districtSelect = document.getElementById('district');
    const constituencySelect = document.getElementById('constituency');
    const searchBtn = document.getElementById('searchBtn');

    districtSelect.addEventListener('change', (e) => {
        const district = e.target.value;
        populateConstituencies(district);
    });

    constituencySelect.addEventListener('change', (e) => {
        searchBtn.disabled = !e.target.value;
    });

    searchBtn.addEventListener('click', () => {
        const constituency = constituencySelect.value;
        if (constituency) {
            fetchMLAData(constituency);
        }
    });
}

function populateConstituencies(district) {
    const constituencySelect = document.getElementById('constituency');
    constituencySelect.innerHTML = '<option value="">-- Select Constituency --</option>';
    
    if (district && KERALA_DATA[district]) {
        constituencySelect.disabled = false;
        KERALA_DATA[district].forEach(constituency => {
            const option = document.createElement('option');
            option.value = constituency;
            option.textContent = constituency;
            constituencySelect.appendChild(option);
        });
    } else {
        constituencySelect.disabled = true;
    }
    
    document.getElementById('searchBtn').disabled = true;
}

async function fetchMLAData(constituency) {
    showLoading(true);
    hideError();
    hideProfile();

    try {
        // SPARQL query to get MLA data from Wikidata
        const sparqlQuery = `
            SELECT ?mla ?mlaLabel ?partyLabel ?image ?article WHERE {
              ?constituency wdt:P31 wd:Q54375467;
                            rdfs:label "${constituency} Assembly constituency"@en.
              ?mla wdt:P39 wd:Q17317747;
                   p:P39 ?statement.
              ?statement ps:P39 wd:Q17317747;
                         pq:P768 ?constituency.
              FILTER NOT EXISTS { ?statement pq:P582 ?endTime }
              OPTIONAL { ?mla wdt:P102 ?party }
              OPTIONAL { ?mla wdt:P18 ?image }
              OPTIONAL {
                ?article schema:about ?mla;
                         schema:isPartOf <https://en.wikipedia.org/>;
                         schema:name ?articleTitle.
              }
              SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }
            LIMIT 1
        `;

        const wikidataUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        const response = await fetch(wikidataUrl);
        const data = await response.json();

        if (data.results.bindings.length === 0) {
            throw new Error('No MLA data found for this constituency');
        }

        const mlaData = data.results.bindings[0];
        currentData = {
            name: mlaData.mlaLabel?.value || 'Unknown',
            party: mlaData.partyLabel?.value || 'Independent',
            image: mlaData.image?.value || '',
            wikidataId: mlaData.mla?.value.split('/').pop(),
            wikipediaUrl: mlaData.article?.value || '',
            constituency: constituency
        };

        // Fetch Wikipedia description
        if (currentData.wikipediaUrl) {
            await fetchWikipediaDescription();
        }

        // Fetch constituency images
        await fetchConstituencyImages(constituency);

        displayMLAProfile();

    } catch (error) {
        console.error('Error fetching MLA data:', error);
        showError('Unable to fetch MLA data. This constituency may not have data available in Wikidata yet.');
    } finally {
        showLoading(false);
    }
}

async function fetchWikipediaDescription() {
    try {
        const pageTitle = currentData.wikipediaUrl.split('/wiki/').pop();
        const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        currentData.description = data.extract || 'No description available.';
        
        // Use Wikipedia thumbnail if Wikidata doesn't have an image
        if (!currentData.image && data.thumbnail) {
            currentData.image = data.thumbnail.source;
        }
    } catch (error) {
        console.error('Error fetching Wikipedia description:', error);
        currentData.description = 'Description not available.';
    }
}

async function fetchConstituencyImages(constituency) {
    try {
        // Search for images on Wikimedia Commons
        const searchQuery = `${constituency} Kerala`;
        const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&format=json&origin=*`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        currentData.constituencyImages = [];
        
        if (data.query && data.query.pages) {
            const pages = Object.values(data.query.pages);
            currentData.constituencyImages = pages
                .filter(page => page.imageinfo && page.imageinfo[0].thumburl)
                .slice(0, 6)
                .map(page => ({
                    url: page.imageinfo[0].thumburl,
                    title: page.title.replace('File:', ''),
                    pageUrl: `https://commons.wikimedia.org/wiki/${page.title.replace(/ /g, '_')}`
                }));
        }
    } catch (error) {
        console.error('Error fetching constituency images:', error);
        currentData.constituencyImages = [];
    }
}

function displayMLAProfile() {
    // Set MLA name and basic info
    document.getElementById('mlaName').textContent = currentData.name;
    document.getElementById('constituencyName').textContent = `${currentData.constituency} Constituency`;
    document.getElementById('partyBadge').textContent = currentData.party;
    
    // Set MLA image
    const mlaImage = document.getElementById('mlaImage');
    if (currentData.image) {
        mlaImage.src = currentData.image;
        mlaImage.alt = currentData.name;
    } else {
        mlaImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
        mlaImage.alt = 'No image available';
    }
    
    // Set description
    document.getElementById('mlaDescription').innerHTML = `<p>${currentData.description || 'No description available.'}</p>`;
    
    // Additional info
    const additionalInfo = document.getElementById('additionalInfo');
    additionalInfo.innerHTML = `
        <div class="info-item">
            <strong>Constituency</strong>
            ${currentData.constituency}
        </div>
        <div class="info-item">
            <strong>Political Party</strong>
            ${currentData.party}
        </div>
        ${currentData.wikipediaUrl ? `
        <div class="info-item">
            <strong>More Information</strong>
            <a href="${currentData.wikipediaUrl}" target="_blank">View on Wikipedia</a>
        </div>
        ` : ''}
    `;
    
    // Display constituency images
    displayConstituencyImages();
    
    // Show profile
    showProfile();
}

function displayConstituencyImages() {
    const gallery = document.getElementById('constituencyImages');
    
    if (currentData.constituencyImages && currentData.constituencyImages.length > 0) {
        gallery.innerHTML = currentData.constituencyImages.map(img => `
            <a href="${img.pageUrl}" target="_blank" class="gallery-item">
                <img src="${img.url}" alt="${img.title}">
                <div class="caption">${img.title.substring(0, 50)}...</div>
            </a>
        `).join('');
    } else {
        gallery.innerHTML = '<p style="color: #999;">No images found for this constituency.</p>';
    }
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

function showProfile() {
    document.getElementById('profileSection').classList.remove('hidden');
}

function hideProfile() {
    document.getElementById('profileSection').classList.add('hidden');
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}
