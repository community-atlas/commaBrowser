//--------------------------------------------------------------------- Globals
// create our global variable for storing our data
let commaGeo = {}; // the raw data
let commaFeatures = []; // processed Features
let commaCategories = {};


// store our global filterset
let commaFilters = {};
// The currently selected feature
let selectedFeature = null;
// current view
let currentView = "map";




// Map globals
var leafletMap = {};
var leafletNodeLayer = {};
var leafletPolygonLayer = {};
var leafletClusterLayer = {};
var leafletLayerGroup = {};
var leafletFeatureLookup = {};

var clickedMarker;
var clickedIcon;
var clickedPoly;
var clickedPolyColor;
let mapFeaturePolyLookup = {};

// Elements 
var bodyElement = {};

// Global Config 
var localConfig;


/**
 * ----------------------------------------------------------------------------------------------
 * Primary Renderers
 */




/**
 * Renders an individual feature on a card
 * @param {object} feature 
 */
function renderCard(feature) {
    let event = feature.properties.start_date ? 'event' : '';
    let geo = (feature.hasOwnProperty('geometry')) ? 'geo' : '';
    let key = commaCategories[feature.properties.category] ? commaCategories[feature.properties.category].key : 0;
    return `<div class="card small hoverable  ${feature.properties.type} ${event} ${geo} category-${key}" data-ref="card"  data-id="${feature.id}">
    <div class="card-image darken-1 waves-effect waves-block waves-light">
    <img src="${feature.properties.image}">
    </div>
    
        <div class="card-content">
            <span class="card-title grey-text text-darken-4"><i class="material-icons right forward">arrow_forward</i><i class="material-icons right back">arrow_back</i>${feature.properties.title}</span>
        </div>
        <div class="card-action">
          <i class="small material-icons date" alt="Feature appears in timeline">date_range</i>
          <i class="small material-icons map" alt="Feature appears on map">map</i>

        </div>       
    </div>`;
}

/**
 * Renders the detailed display of a feature
 * @param {object} feature 
 */
function renderHighlighter(feature) {
    /*
     If we don't have a feature, populate from globals
    */
    if (!feature) {
        feature = {
            'properties': commaGetGlobals(),
            'id': 'all'
        }
    }
    let image = feature.properties.image ? feature.properties.image : '../images/marker.png';
    let event = feature.properties.end_date ? 'event' : '';
    let geo = (feature.hasOwnProperty('geometry')) ? 'geo' : '';

    $("#highlight-summary").html(
        `<div class="card-image"><img src="${image}" /></div>
        <h2><i class="material-icons left zoomClose">arrow_back</i><i class="material-icons right zoomOpen">arrow_forward</i>${feature.properties.title}</h2>         
        `
    )


    let fields = {
        type: 'Type',
        'start': 'Start: ',
        'end': 'End',
        'category': 'Category',
        'subcategory': 'Sub category',

    }
    let properties = feature.properties;
    let content = [];


    content.push(`<div id="highlight-detail-type" class="detail"><i class="material-icons tiny">category</i>
    <span class="type">${properties.type}</span></div>`);

    //category
    if (properties.category) {
        let subcategory = '';
        if (properties['sub-category']) {
            subcategory = `\\<span class="subcategory">${properties['sub-category']}</span>`
        }
        content.push(`<div id="highlight-detail-layers" class="detail"><i class="material-icons tiny ">layers</i>
        <span class="category">${properties.category}</span>${subcategory}</div>`);
    }
    // Event
    if (properties.start_date) {

        let start_date = new Date(properties.start_date).toLocaleDateString();
        let dateContent = `<span class="start">${fields.start} ${start_date}</span>`;
        if (properties.end_date) {
            let end_date = new Date(properties.end_date).toLocaleDateString();
            dateContent += `<span class="end">${fields.end} ${end_date}</span>`;
        }
        content.push(`<div id="highlight-detail-event" class="detail"><i class="material-icons tiny">event</i> ${dateContent}</div>`);
    }
    //lines
    if (properties.links) {
        let links = properties.links.map(link => {
            // we have to have a url
            if (link.url && link.url.length > 0) {
                let url = link.url.toLowerCase().substr(0, 4) == "http" ? link.url : "http://" + link.url;
                let title = (link.title && link.title.length > 0) ? link.title : link.url;
                let type = link.type || "website";
                let description = link.description || "";
                let icon = "language";
                let tooltip = link.description ? "tooltipped" : "";
                return `<a href="${url}"  class="collection-item ${tooltip}" data-position="bottom" data-tooltip="${description}"><i class="material-icons tiny">${icon}</i> ${title}</a>`

            }
        });
        if (links.length > 0) {
            links = links.join("");
            content.push(`<div id="highlight-detail-links" class="collection">${links}</div>`);
        }
    }

    content.push(`
    <div id="highlight-detail-description">        
        <p class="description">${properties.description}<p>
    </div>`);

    if (properties.tags) {
        content.push(renderTagFilters(properties.tags, null));
    }


    if (properties.relationships && properties.relationships.length > 0) {
        let related = properties.relationships.map(id => {
            let feature
            if (feature = commaFeatureFind(id)) {
                return renderCard(feature);
            }
        });
        if (related.length > 0) {
            related = related.join('');
            content.push(`<div id="highlight-detail-related" >
            <h4>Related</h4>
            ${related}
            </div>`);
        }
    }


    //wrapper
    content = content.join('');
    $("#highlight-detail").html(`
        <div id="highlight-detail-properties" class="${geo} ${event}">
           ${content}
        </div>                
    `)
    // Attach events
    $('.tooltipped').tooltip();
    $("#highlight-detail .card-image,  #highlight-detail .card-content").unbind().click(cardClick);
    //  $('#highlight-detail [data-ref="filter"]').click(filterClick);   
}



function renderTools() {
    let editorUrl = commaGetConfig('editorUrl');
    let sourceUrl = commaGetConfig('commaJSONUrl');
    let homepage = commaGetConfig('homepage');
    let globals = commaGetGlobals();

    if (homepage) {
        let about = `<ul>
            <li><a href="${homepage.url}">${homepage.title}</a></li>
        </ul>`;
        $('#tools-atlas').html(about);
    }

    let source = `<ul>
      <li><a href="${editorUrl}">Source editor</a></li>
      <li><a href="${sourceUrl}">Raw GeoJSON source</a></li>
      <li>Published: ${globals.published}</li>
      </ul>`;
    $('#tools-source').html(source);


}


//---------------------------Utils

/**
 * Returns the relevant config 
 * @param {*} key 
 */
function commaGetConfig(key) {

    function getLocalConfig() {
        let configDomain = null;
        let urlParameters = new URLSearchParams(document.URL.search);
        let configKeys = Object.keys(CONFIG);


        if (!(configDomain = urlParameters.get("atlas"))) {
            if (!(configDomain = window.location.hostname.split('.')[0]) || configKeys.indexOf(configDomain) == -1) {
                configDomain = Object.keys(CONFIG)[0];
            }
        }
        console.log(configDomain);
        localConfig = CONFIG[configDomain];
    }

    if (!localConfig) getLocalConfig();
    if (key) {
        return localConfig[key];
    } else {
        return localConfig;
    }
}

/**
 * Process the incoming geodata
 * @param {object} geoData 
 */
function commaInitialiseFeatureData(geoData) {
    commaGeo = geoData;
    commaFeatures = commaUnifyFeatures(geoData)
    commaFeatures = commaFeatures.map(commaFeatureFill);
    commaCategories = commaExtractFeatureCategories(commaFeatures);
    return commaFeatures;
}

/**
 * Fills out any missing or invalid information in a feature
 * @param {object} feature 
 */
var featureIdCounter = 1; // Used to assign ids to features
function commaFeatureFill(feature) {
    let geometry;
    if (!feature.id) {
        feature.id = featureIdCounter++;
    }
    if (!feature.properties.image) {
        if (feature.geometry && (geometry = feature.geometry.coordinates)) {
            if (Array.isArray(geometry[0])) {
                geometry = geometry[0][0];
            }
            feature.properties.image = `https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/${geometry[0]},${geometry[1]},13,0,0/400x300?access_token=pk.eyJ1IjoiZ3JlZW5tYW4yMyIsImEiOiJjazBrMmI1enMwZmkwM2dsaWg3emJnODg1In0.kD8yI6unRQOrVzNY-07-tg`
        }

    }


    let propertyDefaults = {
        "type": '',
        "description": "",
    }

    feature.properties = { ...propertyDefaults, ...feature.properties }
    feature.properties.description = feature.properties.description.replace(/\n/g, "<br />") || '';
    return feature;
}


/**
 * Combines all features into one list
 * @param {*} comma 
 */
function commaUnifyFeatures(comma) {
    let features = comma.features;
    if (comma.nonGeoFeatures) {
        features = comma.features.concat(comma.nonGeoFeatures);
    }
    return features;
}

/**
 * Returns an array of a specific property from all features
 * 
 * @param {} features 
 */
function commaExtractFeatureProperty(features, property = 'type') {
    var properties = features.map(function (feature) { return feature.properties[property] });
    properties = [...new Set(properties)];
    return properties;
}


/**
 * Returns an array of a feature categories
 * 
 * @param {} features 
 */
function commaExtractFeatureCategories(features) {
    let categories = {}
    features.forEach(feature => {
        if (feature.properties.category && !categories[feature.properties.category]) {
            categories[feature.properties.category] = {
                'category': feature.properties.category,
                'description': feature.properties['category-description'],
                'key': Object.keys(categories).length + 1,
            }
        }
    });
    return categories;
}

/**
 * Returns an array of all tags
 * @param {*} features 
 */
function commaExtractFeatureTags(features) {
    let tags = [];
    features.forEach(feature => { if (feature.properties.tags) tags = tags.concat(feature.properties.tags) })
    tags = [...new Set(tags)]
    return tags;
}


function commaGetGlobals() {
    let defaults = {
        type: 'Community atlas',
    };
    return { ...defaults, ...commaGeo.properties }
}

/**
 * Sets the current selected feature
 * 
 * @param {object} feature 
 */
function commaFeatureSelect(selector) {
    // if selector is already selected, we toggle
    if (selectedFeature && selectedFeature.id == selector) selectedFeature = null
    else selectedFeature = commaFeatureFind(selector);
    // get the id 
    let id = null;
    if (selectedFeature) id = selectedFeature.id;
    // update highligher
    renderHighlighter(selectedFeature);
    // update map
    leafletHighightMarker(id);
    // update cards
    cardHighlight(id);
    commaUrlPush();
    if (id) {
        bodyElement.classList.add('showFeatured', 'showDetail');
        // if (currentView!=='map') bodyElement.classList.add('showDetail');  // force detail if we are not on the map
    }
    else {
        bodyElement.classList.remove('showFeatured', 'showDetail');
        //  if (currentView!=='map') bodyElement.classList.remove('showDetail');  // force detail if we are not on the map
    }
}

/**
 * Returns a single feature matching a selector
 * @param {*} id 
 */
function commaFeatureFind(selector = null) {
    let selected = null;
    if (!selector || (selectedFeature && selector == selectedFeature.id)) {
        // if we have no selector, or the selector is the current selected feature
        selected = selectedFeature;
    } else if (selector) {
        // we are looking for a new feature
        let features = commaFeatures;
        selected = features.find(function (feature) {
            return feature.id == selector
        });
    }
    return selected;
}




function commaUrlPush() {
    const filterHash = filterEncode(commaFilters);
    const selectedHash = selectedFeature ? "/" + encodeURIComponent(selectedFeature.id) : '';
    const url = '#' + currentView + "/" + filterHash + selectedHash;
    window.location.assign(url);
}

/**
 * Retrieve settings from the URL
 */
function commaUrlPop() {
    const hash = window.location.hash.substr(1);
    let filterChange = false;
    if (hash) {
        const components = hash.split('/');
        if (components[2]) {
            selectedFeature = commaFeatureFind(decodeURIComponent(components[2]))
        }
        if (components[1].length) {
            commaFilters = filterDecode(components[1]);
            filterChange = true;
        }
        if (components[0].length) {
            commaSetView(components[0]);
        }
    } else {
        // if there is no URL override, check the config for a default      
        if (commaGetConfig('filters')) {
            commaFilters = commaGetConfig('filters');
            filterChange = true;
        }

    }
    return filterChange;
}

//---------------------------Timeline

/**
 * Create a single timeline event node from a commajson feature
 */
function createTimelineEvent(feature) {
    // only get features with dates    
    if (feature.properties.start_date) {
        let event = {};
        let start_date = new Date(feature.properties.start_date);
        let end_date = feature.properties.end_date ? new Date(feature.properties.end_date) : null;
        event.text = {
            "headline": feature.properties.title || "",
            "text": feature.properties.description || "",
        };
        if (start_date) {
            event.start_date = {
                "year": start_date.getFullYear(),
                "month": start_date.getMonth(),
                "day": start_date.getDate(),
            }
            if (end_date) {
                event.end_date = {
                    "year": end_date.getFullYear(),
                    "month": end_date.getMonth(),
                    "day": end_date.getDate(),
                }
            }
        }
        if (feature.properties.image) event.background = { "url": feature.properties.image };
        if (feature.properties.image) event.media = { "url": feature.properties.image };

        return event;
    }
}

/**
 * Convert a comma json file to the KnightLabs Json format
 * 
 */

function convertFeaturesToTimeline(features) {
    let events = features.map(createTimelineEvent);
    // remove nulls
    events = events.filter(x => x);
    let globals = commaGetGlobals();


    const timeline = {
        "events": events,
        "title": {
            'text': {
                'headline': globals.title,
                'text': globals.description,
            }
        }
    }
    if (globals.image) {
        timeline.title.background = { "url": globals.image };
        timeline.title.media = { "url": globals.image };
    }

    return timeline;
}


/**
 * Render a comma json file to a timeline on specific dom element
 * @param {*} element 
 * @param {*} comma 
 */
function renderTimeline(features) {
    let timeline = convertFeaturesToTimeline(features);
    window.timeline = new TL.Timeline('timeline-embed', timeline, { debug: false });
}



//---------------------------- MIXITUP --- CARD VIEW

const container = document.querySelector('[data-ref="container"]');
var firstGap = document.querySelector('[data-ref="first-gap"]');

const mixer = mixitup(container, {
    data: {
        uidKey: 'id'
    },
    render: {
        target: renderCard
    },
    layout: {
        siblingAfter: firstGap // Ensure the first "gap" element is known to mixitup incase of insertion into an empty container
    },
    selectors: {
        target: '[data-ref="card"]'
    }
});



function cardHighlight(selector) {
    let selected = document.querySelector('.card.active');
    if (selected) selected.classList.remove('active');
    if (selector) document.querySelector("[data-id='" + selector + "']").classList.add('active');
}


function renderCards(features) {
    mixer.dataset(features);
}


function cardClick(event) {
    console.log(event.currentTarget);
    let featureId = event.currentTarget.parentElement.dataset.id;
    commaFeatureSelect(featureId);
}


// ------------------------ Leaflet


function renderLeaflet() {
    // L.mapbox.accessToken = mapBoxToken;
    // leafletMap = L.map('leafletMap').setView([51.505, -0.09], 13).addLayer(L.mapbox.styleLayer('mapbox://styles/mapbox/streets-v11'));
    // leafletMap = L.Wrld.map('leafletMap', '68e0ce6179ac3f8ae3df7a9949927879');
    leafletMap = L.map('leafletMap');
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: commaGetConfig('mapId'),
        accessToken: commaGetConfig('mapBoxToken')
    }).addTo(leafletMap);
    leafletMap.on('move', mapOnMove);
}

function renderLeafletFeatures(features) {
    const geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    if (leafletNodeLayer) leafletMap.removeLayer(leafletNodeLayer);
    leafletNodeLayer = L.geoJSON(null, {
        onEachFeature: mapOnEachFeaturePoints,
        //  style: L.mapbox.simplestyle.style
        pointToLayer: mapMarker,
        filter: function (feature) { return feature.geometry.type.toLowerCase() == 'point' }
    }); // .addTo(leafletMap);

    if (leafletPolygonLayer) leafletMap.removeLayer(leafletPolygonLayer);
    leafletPolygonLayer = L.geoJSON(null, {
        onEachFeature: mapOnEachFeaturePoly,
        //  style: L.mapbox.simplestyle.style
        //pointToLayer: L.mapbox.marker.style
        filter: function (feature) { return feature.geometry.type.toLowerCase() != 'point' }
    }).addTo(leafletMap);



    leafletNodeLayer.addData(geojson);
    leafletPolygonLayer.addData(geojson);

    // clustering
    if (leafletClusterLayer) leafletMap.removeLayer(leafletClusterLayer);
    leafletClusterLayer = L.markerClusterGroup();
    leafletClusterLayer.addLayer(leafletNodeLayer);
    leafletMap.addLayer(leafletClusterLayer);

    if (features.length) {
        // make sure that we get the right bounds for our data
        let bounds = leafletNodeLayer.getBounds();
        let polyBounds = leafletPolygonLayer.getBounds();
        bounds.extend(polyBounds.getNorthEast());
        bounds.extend(polyBounds.getSouthWest());
        leafletMap.fitBounds(bounds, { padding: [20, 20] });
    }
}

/**
 * Returns an icon object, tailored for the current selector (category/type etc)
 * @param {string} category 
 * @param {boolean} active 
 */
function mapIcon(category = null, active = false) {
    let key = commaCategories[category] ? commaCategories[category].key : 0;
    active = active ? 'active' : '';
    const icon = L.divIcon({
        className: "mapMarker",
        iconAnchor: [0, 24],
        labelAnchor: [-6, 0],
        popupAnchor: [0, -36],
        html: `<span class="category-${key} ${active}" />`
    })
    return icon;

}

function mapMarker(feature, latlng) {
    let icon = mapIcon(feature.properties.category);
    return L.marker(latlng, { "icon": icon });
}

/**
 * Event handler for map move event
 * @param {*} event 
 */

function mapOnMove(event) {
    commaHighlighterDetailSet(false);
}

/**
 * Process every point feature
 * @param {*} feature 
 * @param {*} layer 
 */
function mapOnEachFeaturePoints(feature, layer) {

    leafletFeatureLookup[feature.id] = L.stamp(layer);
    layer.on('click', function (e) {
        commaFeatureSelect(e.target.feature.id);
    });
}

function mapOnEachFeaturePoly(feature, layer) {
    // store a reference
    mapFeaturePolyLookup[feature.id] = L.stamp(layer);
    layer.on('click', e => {
        mapResetMarkers();
        clickedPoly = e.target;
        clickedPolyColor = e.target.options.color;
        clickedPoly.setStyle({ 'color': '#ff3333' });
        commaFeatureSelect(e.target.feature.id);
    });
}

/**
 * Reset any currently highlighed map features 
 * */
function mapResetMarkers() {
    if (clickedPoly) {
        clickedPoly.setStyle({ 'color': clickedPolyColor });
    }

}

/**
 * Highlight the currently selected marker
 * @todo Unify highlighting
 * @param {string} featureId 
 */
function leafletHighightMarker(featureId) {
    //reset the current marker
    //mapResetMarkers();
    if (featureId) {
        let _leaflet_id = leafletFeatureLookup[featureId];
        if (_leaflet_id) {
            leafletMap.eachLayer(function (layer) {
                //mapResetMarkers();                            	  
                if (layer._leaflet_id == _leaflet_id) {
                    layer.setIcon(mapIcon(layer.feature.properties.category, true));

                    if (clickedMarker) clickedMarker.setIcon(mapIcon(clickedMarker.feature.properties.category, false));
                    clickedMarker = layer;

                }
            });
        }
        else if (_leaflet_id = mapFeaturePolyLookup[featureId]) {
            leafletMap.eachLayer(function (layer) {
                if (layer._leaflet_id == _leaflet_id) {
                    clickedPoly = layer;
                    clickedPolyColor = layer.options.color;
                    clickedPoly.setStyle({ 'color': '#ff3333' });
                }
            });

        }
    }
}

// ======================== Filters

/**
 * Returns a filtered and sorted version of the unified dataset 
 * @param {object } params 
 */
function filterFeatures(params = false, localFilters = false) {
    let features = commaFeatures;
    // filter the features
    if (!localFilters) localFilters = commaFilters;
    features = features.filter(function (feature) {
        let keep = true;
        Object.keys(localFilters).forEach(property => {
            if (feature.properties[property] && Array.isArray(feature.properties[property])) {
                if (feature.properties[property].length == 0) {
                    // there is nothing here
                    keep = false;
                }
                else {
                    let found = false;
                    feature.properties[property].forEach(value => {
                        // loop through each value in the target property                        
                        if (localFilters[property].indexOf(value) != -1) found = true;
                        keep = found;
                    })
                }
            } else if (localFilters[property].indexOf(feature.properties[property]) == -1) {
                keep = false;
            }
        });
        return keep;
    });
    // we can also filter only for geo features
    if (params && params.class) {
        features = features.filter(function (feature) {
            let keep = false;
            if (params.class == 'geo') { keep = feature.hasOwnProperty('geometry') }
            return keep;
        });
    }
    return features;
}


function filterStats() {
    let stats = {};
    Object.keys(commaFilters).forEach(property => {
        stats[property] = commaFilters[property].length;
    })
    return stats;
}




/**
 * Reset filters to default
 */
function filterReset() {
    let filters = commaGetConfig('filters');
    if (!filters) {
        filters = {}
    }
    commaFilters = filters;
    return filters;
}


// returns the current filters
function filterGet() {
    return commaFilters;
}



// set the state of a filter
function filterSet(attribute, value, state) {
    if (commaFilters[attribute]) {
        let index = commaFilters[attribute].indexOf(value);
        if (state && index == -1) {
            commaFilters[attribute].push(value);
        } else if (!state && index !== -1) {
            // remove the value 
            if (commaFilters[attribute].length == 1) {
                delete commaFilters[attribute];
            } else {
                commaFilters[attribute].splice(index, 1);
            }
        }
    } else if (!commaFilters[attribute] && state) {
        // Add a new property
        commaFilters[attribute] = [value];
    }
}

// handle a click on a filter
function filterClick(event) {
    let element = event.target;
    let state = !element.classList.contains('active');
    Object.keys(element.dataset).forEach(attribute => {
        if (attribute != "ref") filterSet(attribute, element.dataset[attribute], state);

    });
    filterDisplayUpdate(commaFilters);
    commaUrlPush();
    commaRender();
}

function filterResetClick() {
    filterReset();
    filterDisplayUpdate();
    commaUrlPush();
    commaRender();

}

// Update all filter elements with the active class
function filterDisplayUpdate(localFilters = null) {
    if (!localFilters) localFilters = commaFilters;
    let elements = document.querySelectorAll('[data-ref="filter"]');
    elements.forEach(element => {
        element.classList.remove('active');
        Object.keys(localFilters).forEach(property => {
            if (localFilters[property].includes(element.dataset[property])) element.classList.add('active')
        });
    });
    let stats = filterStats();
    $('#controls-category-badge').replaceWith(`<span id="controls-category-badge" class="new badge"  data-badge-caption="">${stats.category || 0}</span>`)
    $('#controls-type-badge').replaceWith(`<span id="controls-type-badge" class="new badge"  data-badge-caption="">${stats.type || 0}</span>`)
    $('#controls-tags-badge').replaceWith(`<span id="controls-tags-badge" class="new badge"  data-badge-caption="">${stats.tags || 0}</span>`)

}


/**
 * Returns a string that can be used in the url hash
 * @param {object} filters 
 */
function filterEncode(filters) {
    let path = Object.keys(filters).map(filter => {
        if (filters[filter]) {
            let encoded = filters[filter].map(encodeURIComponent)
            return encodeURIComponent(filter) + ":" + encoded.join(',')
        }
    });
    return path.join('::');
}

/**
 * Returns an object containing the filters defined in the url hash
 * @param {string} hash 
 */
function filterDecode(hash) {
    let filters = {};
    const components = hash.split('::');
    components.forEach(element => {
        const propertyFilter = element.split(':');
        filters[decodeURIComponent(propertyFilter[0])] = propertyFilter[1].split(',').map(decodeURIComponent);
    });
    return filters;
}

/**
 * Renders a set of simple filters for a given property
 * @param { array } values  An array of possible values
 * @param { string } property   The name of the property being filtered
 */
function renderPropertyFilters(values, property = 'type') {

    function renderFilter(value) {
        return `<div class="chip control-filter control-filter-${property}" 
        data-ref="filter" data-${property}="${value}" >${value}</div>`
    }
    const filters = values.map(renderFilter);
    $('#controls-' + property).html(filters.join(''));
}


/**
 * Renders the filters for the categories
 * @param {array of objects} values 
 */
function renderCategoryFilters(values) {
    function renderFilter(key) {
        let value = values[key];
        //  return `<button type="button" class="mui-btn control control-filter control-filter-${property}" 
        //  data-ref="filter" data-${property}="${value.category}"  title="${value.description}">${value.category}</button>`


        return `<div class="chip control-filter control-filter-${property} category-${value.key}" 
           data-ref="filter" data-${property}="${value.category}"  title="${value.description}">${value.category}</div>`


    }

    const property = 'category';
    const filters = Object.keys(values).map(renderFilter).join('');
    const content = filters;
    $('#controls-category').html(content);
}



function renderTagFilter(value) {
    return `<div class="chip control-filter control-filter-tags" 
    data-ref="filter" data-tags="${value}" >${value}</div>`
}

function renderTagFilters(tags, elementLocator = "#controls-tags") {
    let filters = tags.map(renderTagFilter).join('');
    if (elementLocator) $(elementLocator).html(filters);
    return filters;
}


function renderFilters(features) {
    const categories = commaExtractFeatureCategories(features);
    const types = commaExtractFeatureProperty(features, 'type');
    const tags = commaExtractFeatureTags(features);

    renderPropertyFilters(types);
    renderCategoryFilters(categories);
    renderTagFilters(tags);
    $('[data-ref="filter"]').click(filterClick);

}


// =======================================================






function commaHighlighterDetailSet(show) {
    if (show) bodyElement.classList.add('showDetail', 'showFeatured');
    else {
        // remove the detail, but put the small card back
        bodyElement.classList.remove('showDetail');
        bodyElement.classList.add('showFeatured');
    }

}

/**
 * Zooms into the emlement detail
 * @param {*} element 
 */
function commaHighlighterDetailToggle(element) {
    bodyElement.classList.toggle('showDetail');
    bodyElement.classList.add('showFeatured');
}


/**
 * Render all standard elements. 
 */
function commaRender() {
    let features = filterFeatures();
    mixer.dataset(features);
    if (currentView == 'timeline') {
        // the timeline can only be rendered if it is visible
        renderTimeline(features);
    }
    let geoFeatures = filterFeatures({
        "class": "geo"
    })
    // renderMapFeatures(map, geoFeatures);
    renderLeafletFeatures(geoFeatures);
    $(".card-image, .card-content").unbind().click(cardClick);
    if (features.length) {
        M.toast({ html: `${features.length} feature(s) available to explore` })
    } else {
        M.toast({ html: `There are no features that match your filter. Update or reset your filters.` })
    }



}


/**
 * Onclick handler for view change
 * @param {object} element 
 */
function commaViewer(element) {
    commaSetView(element.currentTarget.dataset.view);
}


/**
 * Changes the current view
 * @param {string} view 
 */
function commaSetView(view) {
    let cssClass;
    switch (view) {
        case 'timeline':
            cssClass = 'viewTimeline';
            break;
        case 'cards':
            cssClass = 'viewCards';
            break;
        case 'map':
        default:
            cssClass = 'viewMap';
            break;
    }

    if (!bodyElement.classList.contains(cssClass)) {
        if (bodyElement.classList.length > 0) bodyElement.classList.remove('viewMap', 'viewTimeline', 'viewCards');
        bodyElement.classList.add(cssClass);
        currentView = view;
        commaUrlPush();
        commaRefresh();
    }

}

/**
 * refresh elements of the page depending on the current view
 */
function commaRefresh() {

    if (currentView == 'timeline') {
        renderTimeline(commaFeatures);
    }
    else if (currentView == 'map') {
        leafletMap._onResize();
    }
}

//==========================================================


/**
 * Initialise the matarialize interface features
 */
function initMaterialize() {
    M.AutoInit();
    /*  let tabElement = document.querySelector('.tabs')
      var tabs = M.Tabs.init(tabElement, {'onShow':materializeTabs});*/

    var elems = document.querySelectorAll('.sidenav');
    var instances = M.Sidenav.init(elems, {
        onOpenEnd: commaRefresh,
        onCloseEnd: commaRefresh
    });

}


/**
 * Apply translation
 */
function translateTexts(selector = 'body') {
    $('body').i18n();
}


//==========================================================

$(document).ready(function () {
    bodyElement = document.getElementsByTagName('body')[0];
    $.i18n.debug = true;
    let lang= commaGetConfig('lang') || "en";
    $.i18n().locale = lang;
    $.i18n().load(
        {
            "en" : "browser/translation/en.json",
            "de" : "browser/translation/de.json"
        }
        );

    $.getJSON(commaGetConfig('commaJSONUrl')).done(function (data) {
        let features = commaInitialiseFeatureData(data);
        let globals = commaGetGlobals();


        //@todo...... Move these
        document.title = "Community Atlas >> " + globals.title;
        $("nav #title").html(globals.title);
        $("#cards-header-content").html(globals.title);


        // perform initial rendering of all aspects so that we start will all the right data
        //viewTabEventsInit();
        //  initDrawers();

        renderFilters(features);
        //renderCards(commaFeatures);
        //renderTimeline(commaFeatures);        
        renderLeaflet();
        initMaterialize();
        //renderLeafletFeatures(commaGetFeatures({ class: 'geo' }));

        // Now, if there are any updates pushed from the url or config update the display
        if (commaUrlPop()) {
            filterDisplayUpdate();
        }
        commaRender();
        renderTools();
        //lets see if we have a valid feature selected                      
        renderHighlighter(commaFeatureFind());
        commaSetView(currentView);
        commaHighlighterDetailSet(commaGetConfig('showDetail'));
        translateTexts();



        // renderViewControls();

        $("#highlight-summary").click(commaHighlighterDetailToggle);
        $("[data-ref='view']").click(commaViewer);
        $("#controls-reset").click(filterResetClick);
        $('.lang-switch').click(function (e) {
            e.preventDefault();
            $.i18n().locale = $(this).data('locale');
            translateTexts();
        });

        if (typeof test === "function") {
            $('#tests').html(test());
        }


    });
});
