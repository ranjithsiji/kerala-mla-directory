const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIPEDIA_API_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

class WikiAPI {
    static getThumbnailUrl(imageUrl, width = 500) {
        if (!imageUrl) return null;
        const fileName = imageUrl.split('/').pop();
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}?width=${width}`;
    }

    static async fetchWikidata(sparqlQuery) {
        const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/sparql-results+json',
                    'User-Agent': 'KeralaMLAApp/1.0 (https://github.com/alphaf42/keralamla)'
                }
            });
            if (!response.ok) throw new Error('Wikidata fetch failed');
            return await response.json();
        } catch (error) {
            console.error('Error fetching from Wikidata:', error);
            return null;
        }
    }

    static async getDistricts() {
        const query = `
            SELECT ?item ?itemLabel WHERE {
                ?item wdt:P31 wd:Q1149652;
                      wdt:P131 wd:Q1186.
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            } ORDER BY ?itemLabel
        `;
        return await this.fetchWikidata(query);
    }

    static async getConstituencies(districtId) {
        // Cleaning the ID from Wikidata URL if needed
        const dId = districtId.split('/').pop();
        const query = `
            SELECT ?item ?itemLabel WHERE {
                ?item wdt:P31 wd:Q54375461;
                      wdt:P131 wd:${dId}.
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            } ORDER BY ?itemLabel
        `;
        return await this.fetchWikidata(query);
    }

    static async getMLA(constituencyId) {
        const cId = constituencyId.split('/').pop();
        const query = `
            SELECT ?mla ?mlaLabel ?image ?partyLabel ?wikipedia ?dob ?pobLabel ?occupationLabel ?educationLabel ?nativeLangLabel ?residenceLabel 
                   (GROUP_CONCAT(DISTINCT ?langLabel; SEPARATOR=", ") AS ?languages) 
                   (GROUP_CONCAT(DISTINCT ?degreeLabel; SEPARATOR=", ") AS ?degrees)
            WHERE {
                ?mla p:P39 ?statement.
                ?statement ps:P39 wd:Q106684477;
                           pq:P768 wd:${cId}.
                FILTER NOT EXISTS { ?statement pq:P582 ?endTime. }
                OPTIONAL { ?mla wdt:P18 ?image. }
                OPTIONAL { ?mla wdt:P102 ?party. }
                OPTIONAL { ?mla wdt:P569 ?dob. }
                OPTIONAL { ?mla wdt:P19 ?pob. }
                OPTIONAL { ?mla wdt:P106 ?occupation. }
                OPTIONAL { ?mla wdt:P69 ?education. }
                OPTIONAL { ?mla wdt:P103 ?nativeLang. }
                OPTIONAL { ?mla wdt:P551 ?residence. }
                OPTIONAL { ?mla wdt:P1412 ?lang. }
                OPTIONAL { ?mla wdt:P512 ?degree. }
                
                OPTIONAL {
                    ?wikipedia schema:about ?mla;
                               schema:isPartOf <https://en.wikipedia.org/>.
                }
                SERVICE wikibase:label { 
                    bd:serviceParam wikibase:language "en". 
                    ?mla rdfs:label ?mlaLabel.
                    ?party rdfs:label ?partyLabel.
                    ?pob rdfs:label ?pobLabel.
                    ?occupation rdfs:label ?occupationLabel.
                    ?education rdfs:label ?educationLabel.
                    ?nativeLang rdfs:label ?nativeLangLabel.
                    ?residence rdfs:label ?residenceLabel.
                    ?lang rdfs:label ?langLabel.
                    ?degree rdfs:label ?degreeLabel.
                }
            } GROUP BY ?mla ?mlaLabel ?image ?partyLabel ?wikipedia ?dob ?pobLabel ?occupationLabel ?educationLabel ?nativeLangLabel ?residenceLabel
            LIMIT 1
        `;
        return await this.fetchWikidata(query);
    }

    static async getWikipediaSummary(pageTitle) {
        try {
            const response = await fetch(`${WIKIPEDIA_API_ENDPOINT}${encodeURIComponent(pageTitle)}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching Wikipedia summary:', error);
            return null;
        }
    }

    static async getWikipediaFullHTML(lang, pageTitle) {
        const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&format=json&prop=text|displaytitle&origin=*`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.parse) {
                return {
                    title: data.parse.displaytitle,
                    text: data.parse.text['*']
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching full Wikipedia HTML:', error);
            return null;
        }
    }

    static async getWikidataFullHTML(qid) {
        const url = `https://www.wikidata.org/w/api.php?action=parse&formatversion=2&page=${qid}&prop=text&format=json&origin=*`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.parse) {
                return data.parse.text;
            }
            return null;
        } catch (error) {
            console.error('Error fetching Wikidata full HTML:', error);
            return null;
        }
    }

    static async getWikidataClaims(qid) {
        const query = `
            SELECT ?wdLabel ?ooLabel ?o
            WHERE {
                VALUES (?s) { (wd:${qid}) }
                ?s ?wdt ?o .
                ?wd wikibase:directClaim ?wdt .
                ?wd rdfs:label ?wdLabel .
                OPTIONAL {
                    ?o rdfs:label ?oLabel .
                    FILTER (lang(?oLabel) = "en")
                }
                FILTER (lang(?wdLabel) = "en")
                BIND (COALESCE(?oLabel, ?o) AS ?ooLabel)
            }
            ORDER BY xsd:integer(STRAFTER(STR(?wd), "http://www.wikidata.org/entity/P"))
        `;
        return await this.fetchWikidata(query);
    }

    static async getConstituencyDetails(constituencyId) {
        const cId = constituencyId.split('/').pop();
        const query = `
            SELECT ?itemLabel ?image ?map ?wikipedia ?inception ?area ?districtLabel WHERE {
                BIND(wd:${cId} as ?item)
                OPTIONAL { ?item wdt:P18 ?image. }
                OPTIONAL { ?item wdt:P242 ?map. }
                OPTIONAL { ?item wdt:P571 ?inception. }
                OPTIONAL { ?item wdt:P2046 ?area. }
                OPTIONAL { ?item wdt:P131 ?district. }
                OPTIONAL {
                    ?wikipedia schema:about ?item;
                               schema:isPartOf <https://en.wikipedia.org/>.
                }
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            } LIMIT 1
        `;
        return await this.fetchWikidata(query);
    }

    static async getConstituencyGeoshapes(constituencyId) {
        const cId = constituencyId.split('/').pop();
        const query = `
            SELECT ?item ?itemLabel ?geoshape ?wikipedia ?wikipediaML WHERE {
                ?item wdt:P7938 wd:${cId}.
                ?item wdt:P3896 ?geoshape.
                OPTIONAL {
                    ?wikipedia schema:about ?item;
                               schema:isPartOf <https://en.wikipedia.org/>.
                }
                OPTIONAL {
                    ?wikipediaML schema:about ?item;
                                 schema:isPartOf <https://ml.wikipedia.org/>.
                }
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
            }
        `;
        return await this.fetchWikidata(query);
    }

    static async getGeojson(geoshapeUrl) {
        // geoshapeUrl is like "http://commons.wikimedia.org/data/main/Data:Kerala/Kannur/Dharmadom.map"
        const titles = decodeURIComponent(geoshapeUrl.split('/data/main/').pop());
        const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=revisions&rvprop=content&titles=${encodeURIComponent(titles)}&origin=*`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pageId === "-1") return null;
            const content = pages[pageId].revisions[0]['*'];
            return JSON.parse(content);
        } catch (error) {
            console.error('Error fetching GeoJSON:', error);
            return null;
        }
    }

    static async getConstituencyImages(constituencyLabel) {
        // Search Wikimedia Commons for images related to the constituency
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=File:${encodeURIComponent(constituencyLabel)}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`;
        try {
            const response = await fetch(searchUrl);
            const data = await response.json();
            if (data.query && data.query.pages) {
                return Object.values(data.query.pages).map(page => page.imageinfo[0].url);
            }
            return [];
        } catch (error) {
            console.error('Error fetching images from Commons:', error);
            return [];
        }
    }
}
