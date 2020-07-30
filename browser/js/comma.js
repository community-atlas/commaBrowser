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
// sort 
let sortProperty = "title";
let sortAsc = true;
let commaLanguage = "en";
let commaLiveMode = false;  // controls caching of geodata
let commaLiveReloadTimer = null;




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

var leafletPolyStroke = 'darkcyan';
var leafletPolyStrokeActive = '#eb5757';

let mapFeaturePolyLookup = {};

// Elements 
var bodyElement = {};

// Global Config 
var localConfig;


 function commaDevMode() {
    let globals = commaGetGlobals();
    if (globals.urlParams.get('devmode')) { 
        return true
    }
    return false
}


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
    let key = commaCategories[feature.properties.category] ? commaCategories[feature.properties.category].id : 0;
    let description = feature.properties.description.substr(0,120).replace(/<[^>]*>?/gm, ' ');
    return `<div class="card small hoverable  ${feature.properties.type} ${event} ${geo} category-${key}" data-ref="card"  data-id="${feature.id}">
    <div class="card-image darken-1 waves-effect waves-block waves-light">
    <img src="${feature.properties.image}">
    <span class="card-title grey-text text-darken-4"><i class="material-icons right forward">arrow_forward</i><i class="material-icons right back">arrow_back</i>${feature.properties.title}</span>
    </div>    
     <!--   <div class="card-action">
          <i class="small material-icons date" >date_range</i>
          <i class="small material-icons map">map</i>

        </div>-->       
    </div>`;
}

/** Updates the open graph metadata based on the selected feature */
function commaSetMetadata(feature) {
    let globals = commaGetGlobals();
    let image = feature.properties.image ? feature.properties.image : 'browser/images/atlas-logo-x1.png';
    let properties = feature.properties;
    let title = globals.title + " >> " +feature.properties.title.replace(/"/g, '&quot;');    

    let tags = `#${properties.category}`
    if (properties.tags) {
        tags = tags + ' #' + properties.tags.join(" #");        
    }
    let description = properties.description + ' ' + tags;

    document.querySelector('meta[property="og:title"]').setAttribute("content", title);
    document.querySelector('meta[property="og:image"]').setAttribute("content", image);
    document.querySelector('meta[property="og:description"]').setAttribute("content", description);



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
    let image = feature.properties.image ? feature.properties.image : 'browser/images/atlas-logo-x1.png';
    let event = feature.properties.end_date ? 'event' : '';
    let geo = (feature.hasOwnProperty('geometry')) ? 'geo' : '';
    let credit = feature.properties.image_credit || '' 

    $("#highlight-summary").html(        
        `<i id="summary-close" class="material-icons right">close</i><div class="card-image"><span class="image-credit">${credit}</span><img src="${image}" /></div>
        <h2><i class="material-icons left zoomClose">arrow_back</i><i class="material-icons right zoomOpen">arrow_forward</i>${feature.properties.title}</h2>         
        `
    )

    
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
        let dateContent = `<span class="start"><i class="material-icons tiny ">play_arrow</i> ${start_date}</span>`;
        if (properties.end_date) {
            let end_date = new Date(properties.end_date).toLocaleDateString();
            dateContent += ` <span class="end"><i class="material-icons tiny ">stop</i> ${end_date}</span>`;
        }
        content.push(`<div id="highlight-detail-event" class="detail"><i class="material-icons tiny">event</i> ${dateContent}</div>`);
    }
    //links    
    if (properties.links) {
        let links = properties.links.map(link => {
            // we have to have a url
            if (link.url && link.url.length > 0) {
                let url = (link.url.toLowerCase().substr(0, 4) == "http" || link.url.toLowerCase().substr(0, 6) == "mailto") ? link.url : "http://" + link.url;
                let title = (link.title && link.title.length > 0) ? link.title : link.url;
                let type = link.type || "website";
                let description = link.description || "";
                let icon = "web"; // default
                let lightbox = ""; // disable lightbox on most links
                switch(type){
                    case "website": 
                        icon="web";
                        break;
                    case "email":
                        icon="email"
                        break;
                    case "translation":
                        icon="language"
                        break;
                    case "video":
                        icon="play_circle_filled"
                        lightbox="lightbox";
                        break;
                    case "image":
                        icon="image";
                        lightbox="lightbox"
                        break;
                } 
 

                let tooltip = link.description ? "tooltipped" : "";
                return `<a href="${url}"  class="collection-item ${tooltip} ${lightbox}" data-position="bottom" data-tooltip="${description}" target="_blank"><i class="material-icons tiny">${icon}</i> ${title}</a>`

            }
        });
        if (links.length > 0) {
            links = links.join("");
            content.push(`<div id="highlight-detail-links" class="collection">${links}</div>`);
        }
    }
    // set up editor contact if we are on the main blurb
    let contact = '';
    /** 
    if (feature.id == 'all') {
        let contactLink = commaGetConfig('editorContact');
        contact = `<p id="contact"><a href="${contactLink}"><i class="material-icons tiny">email</i></a></p>`
    }**/
    content.push(`
    <div id="highlight-detail-description">        
        <p class="description">${properties.description}<p>
        ${contact}
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


    // set og metadata

    commaSetMetadata(feature);
    // Attach events
    $('.tooltipped').tooltip();
    $("#highlight-detail .card-image,  #highlight-detail .card-content").unbind().click(cardClick);
    //  $('#highlight-detail [data-ref="filter"]').click(filterClick);   
    $().fancybox({
      selector : '#highlight-detail-links a.lightbox'
    });    
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
      <li><a href="${editorUrl}" data-i18n="tools_source_editor">Source editor</a></li>
      <li><a href="${sourceUrl}" data-i18n="tools_raw">Raw GeoJSON source</a></li>
      <li>Published: ${globals.published}</li>
      <li><a id="reload-trigger" href="#" data-i18n="tools_reload" >Reload</a></li>
      <li><div class="switch">Live mode
      <label>
        Off
        <input id="control-liveMode" type="checkbox">
        <span class="lever"></span>
        On
      </label>
    </div>

      </ul>`;
    $('#tools-source').html(source);
    $('#reload-trigger').click(commaReloadGeoData);

}

function renderFooter(){
  let logoData = commaGetConfig('logos') || [];
  let logos = logoData.map(data => {
      let href = data.href || '#';
      let fragment = `<img src="${data.src}" alt="${data.alt || ''}"/>\n`
      if (data.href) {
        fragment = `<a href="${href}" target ="_blank">${fragment}</a>\n`
      }
      
      return fragment;
  })
  $("#footer-logos").html(logos);
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
            console.log(geometry)
            if (feature.geometry.type=='PolyLine') {
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
    let features = comma.features || [];
    if (features && comma.nonGeoFeatures) {
        features = features.concat(comma.nonGeoFeatures);
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
    console.log(properties);
    properties = properties.filter(n => n.length > 0)
    return properties;
}


/**
 * Returns an array of a feature categories
 * 
 * @param {} features 
 */
function commaExtractFeatureCategories(features) {
    let categories = {}
    let globals = commaGetGlobals();
    if (globals.taxonomy) {
        let categoryArray = globals.taxonomy;
        categoryArray = categoryArray.sort((a = 0,b = 0) => a.weight - b.weight)
        //convert to an object
        categoryArray.forEach(category => {
            categories[category.category]=category;
        })
    } 
    else {
        // there is no taxonomy property, so lets work out our categories
        features.forEach(feature => {
            if (feature.properties.category && !categories[feature.properties.category]) {
                categories[feature.properties.category] = {
                    'category': feature.properties.category,
                    'description': feature.properties['category-description'],
                    'id': Object.keys(categories).length + 1,
                }
            }
        });
    }
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
    defaults.urlParams = new URLSearchParams(window.location.search);    
    return { ...defaults, ...commaGeo.properties }
}



/**
 * Sets the current selected feature
 * 
 * @param {object} feature
 * @param {boolean} zoom Zoom map to selected feature  
 */
function commaFeatureSelect(selector, zoom = true) {
    
    // if selector is already selected, we toggle
    if (selector === null || (selectedFeature && selectedFeature.id == selector)) {
        selectedFeature = null       
    }
    else selectedFeature = commaFeatureFind(selector);
    // get the id 
    let id = null;
    if (selectedFeature) id = selectedFeature.id;
    console.log(`Select new feature: ${id} zoom: ${zoom}`)
    // update highligher
    renderHighlighter(selectedFeature);
    // update map
    leafletHighightMarker(id, zoom);
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


/**
 * Sort features by attribute
 * @param {*} features 
 * @param {*} property 
 * @param {*} asc 
 */
function commaFeatureSort(features, property=null, asc=null){
    if (!property) property = sortProperty;
    if (asc == null) asc = sortAsc; 

    features = features.sort((a,b) =>{ 
           let aVal = a.properties[property];
           let bVal = b.properties[property];
           if (typeof aVal == "string") {
               aVal = aVal.toLowerCase().trim();
               bVal = bVal.toLowerCase().trim();
           }
           return (aVal > bVal) ? 1 : -1 ;              
    });
    if (!asc) features = features.reverse();
    return features;
  }


/**
 * Push a Url into the window location
 */
function commaUrlPush() {
    const filterHash = filterEncode(commaFilters);
    const selectedHash = selectedFeature ? "/" + encodeURIComponent(selectedFeature.id) : '';
    const url = '#' + currentView + "/" + filterHash + selectedHash;
    window.location.assign(url);
    analyticsUrlTrack(url);
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
        if (components[1] && components[1].length) {
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


/**
 * Pull a new copy of the geo data
 */
function commaReloadGeoData(){
    // Don't cache the JSON data
    $.ajaxSetup({
        cache:false
    });
    console.log('checking for new data');
    $.getJSON(commaGetConfig('commaJSONUrl')).done(function (data) {
        if (data.properties.published != commaGeo.properties.published) {
            console.log('Got new data');
             // we have an update    
            commaInitialiseFeatureData(data);        
            commaRender();
            renderTools();
            renderFilters();
        }
    });
}

/**
 * Returns an array of colours
 * 
 */
function commaGetColours(){
  let colours = [
      'darkblue',
      'darkcyan',
      'darkgoldenrod',
      'darkmagenta',
      'darkolivegreen',
      'darkred',
      'darkturquoise',
      'darkslateblue',
      'darkslategray',
      'darkseagreen',
      'darkorchid'
  ]
  return colours;

}

//------------------ Analytics


/**
 * Push a url to analytics
 * @param {string} url 
 */
function analyticsUrlTrack(url) {
    gtag('config', GA_MEASUREMENT_ID, {'page_path': url});
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
        let end_date = feature.properties.end_date ? new Date(feature.properties.end_date) : new Date(Date.now());
        event.text = {
            "headline": feature.properties.title || "",
            "text": feature.properties.description || "",
        };
        if (start_date) {
            event.start_date = {
                "year": start_date.getFullYear(),
                "month": start_date.getMonth()+1,
                "day": start_date.getDate(),
            }
            if (end_date) {
                event.end_date = {
                    "year": end_date.getFullYear(),
                    "month": end_date.getMonth()+1,
                    "day": end_date.getDate(),
                }
            }
        }
        if (feature.properties.image) event.background = { 
            "url": feature.properties.image,
            //"color": 'blue'  // if we can generate category colors in code, we can use them here. Not perfect, but useful. 
        };
        if (feature.properties.image) event.media = { "url": feature.properties.image };
        if (feature.properties.category) event.group = feature.properties.category;
        event.unique_id = feature.id;
``

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
    let options = {
        debug: false,
        language: commaLanguage,                
    }
    if (timeline.events.length) {   
      window.timeline = new TL.Timeline('timeline-embed', timeline, options);
    } else {
        // we should probably remove the timeline
        // but this prevents the error message 
    }
    if (selectedFeature && selectedFeature.id) window.timeline.goToId(selectedFeature.id)
    window.timeline.addEventListener('change',e =>{
        commaFeatureSelect(e.unique_id);
    });
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
    if (selector) {
        let element = document.querySelector("[data-id='" + selector + "']");
        if (element) {
            element.classList.add('active')
            element.scrollIntoView({
                behavior:'smooth'
            });
        }
    }
}


function renderCards(features) {
    mixer.dataset(features);
}


function cardClick(event) {    
    let featureId = event.currentTarget.parentElement.dataset.id;
    commaFeatureSelect(featureId);
}


// ------------------------ Leaflet


function renderLeaflet() {
    // L.mapbox.accessToken = mapBoxToken;
    // leafletMap = L.map('leafletMap').setView([51.505, -0.09], 13).addLayer(L.mapbox.styleLayer('mapbox://styles/mapbox/streets-v11'));
    // leafletMap = L.Wrld.map('leafletMap', '68e0ce6179ac3f8ae3df7a9949927879');
    leafletMap = L.map('leafletMap').setView([0,0],2);
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
        color: leafletPolyStroke,
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
 * Returns a colour code for a category
 * @param {*} category 
 */
function mapColour(category){
  let colours = commaGetColours();  
  if (typeof(category) === 'string') {
    category = commaCategories[category] ? commaCategories[category].id : 0;
  }
  return colours[category]
}
/**
 * Returns an icon object, tailored for the current selector (category/type etc)
 * @param {string} category 
 * @param {boolean} active 
 */
function mapIcon(category = null, active = false) {
    let key = commaCategories[category] ? commaCategories[category].id : 0;
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
    //commaHighlighterDetailSet(false);
}

/**
 * Process every point feature
 * @param {*} feature 
 * @param {*} layer 
 */
function mapOnEachFeaturePoints(feature, layer) {

    leafletFeatureLookup[feature.id] = L.stamp(layer);
    layer.on('click', function (e) {
        commaFeatureSelect(e.target.feature.id, false);
    });
}

function mapOnEachFeaturePoly(feature, layer) {
    // store a reference    
    mapFeaturePolyLookup[feature.id] = L.stamp(layer);
    let category = commaCategories[feature.properties.category];
    let key =  category ? category.id : 0;    
    layer.setStyle({
        className:"category-"+key,
        'color': mapColour(key)
        });    
    layer.on('click', e => {
        e.target.bringToBack();
        commaFeatureSelect(e.target.feature.id, false);
    });
}


/**
 * Highlight the currently selected marker
 * @todo Unify highlighting
 * @param {string} featureId 
 * @param {boolean} zoom  zoom to marker
 */
function leafletHighightMarker(featureId, zoom = true) {
    //reset old colours
    if (clickedMarker) clickedMarker.setIcon(mapIcon(clickedMarker.feature.properties.category, false));
    console.log(clickedPoly);
    if (clickedPoly) clickedPoly.setStyle({ 'color': mapColour(clickedPoly.feature.properties.category) });
    if (featureId) {
        let _leaflet_id = leafletFeatureLookup[featureId];  
        console.log(`Highlighting leaflet id: ${_leaflet_id}`)      
        if (_leaflet_id) {
            leafletMap.eachLayer(function (layer) {                       	  
                console.log(` - ${layer._leaflet_id}`)
                if (layer._leaflet_id == _leaflet_id) {
                    layer.setIcon(mapIcon(layer.feature.properties.category, true));    
                    clickedMarker = layer;
                    console.log("Found feature")
                    if (zoom) {
                        console.log("Zooming")
                        var latLngs = [ clickedMarker.getLatLng() ];
                        var markerBounds = L.latLngBounds(latLngs);
                        leafletMap.fitBounds(markerBounds);
                    }
                }
            });
        }
        else if (_leaflet_id = mapFeaturePolyLookup[featureId]) {
            leafletMap.eachLayer(function (layer) {
                if (layer._leaflet_id == _leaflet_id) {
                    clickedPoly = layer;
                    clickedPoly.setStyle({ 'color': leafletPolyStrokeActive });
                    if (zoom) {
                        var latLngs = clickedPoly.getLatLngs();
                        var markerBounds = L.latLngBounds(latLngs);
                        leafletMap.fitBounds(markerBounds);
                    }
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
        let keep = {}
        let finalKeep = true;
        Object.keys(localFilters).forEach(property => {
            keep[property]=true;
            if (feature.properties[property] && Array.isArray(feature.properties[property])) {
                if (feature.properties[property].length == 0) {
                    // there is nothing here
                    keep[property] = false;
                }
                else {
                    let found = false;
                    feature.properties[property].forEach(value => {
                        // loop through each value in the target property                        
                        if (localFilters[property].indexOf(value) != -1) found = true;
                        keep[property] = found;
                    })
                }
            } else if (localFilters[property].indexOf(feature.properties[property]) == -1) {
                keep[property] = false;
            }
        });
        //console.log(keep);
        keep = Object.keys(keep).forEach(property => {
            finalKeep = keep[property] && finalKeep;
        });
        //console.log(finalKeep)
        return finalKeep;
    });
    // we can also filter only for geo features
    if (params && params.class) {
        features = features.filter(function (feature) {
            let keep = false;
            if (params.class == 'geo') { keep = feature.hasOwnProperty('geometry') }
            return keep;
        });
    }
    features = commaFeatureSort(features)

    return features;
}



function filterStats() {
    let stats = {
        total: 0
    };
    Object.keys(commaFilters).forEach(property => {
        stats[property] = commaFilters[property].length;
        stats.total += stats[property];
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
        if (['category','tags','type'].indexOf(attribute)!=-1) filterSet(attribute, element.dataset[attribute], state);

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
    if (stats.total) {
        $('body').removeClass('noFilters');
    } else {
        $('body').addClass('noFilters');
    }


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
        if (Array.isArray(propertyFilter) && propertyFilter[1]) {
            filters[decodeURIComponent(propertyFilter[0])] = propertyFilter[1].split(',').map(decodeURIComponent);
        }
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
        let cssClass = `chip control-filter control-filter-${property} category-${value.id}`
        let tooltip = "";
        if (value.description.length > 0)  {
            let position = "right";
            if (window.innerWidth > 922) {
                // tooltips don't work for categories on mobile            
                tooltip = `data-position="${position}" data-tooltip="${value.description}"`;
            }
            cssClass = cssClass + " tooltipped";
        }            
        return `<div class="${cssClass}" data-ref="filter" data-${property}="${value.category}"  ${tooltip}  >${value.category}<i style="pointer-events:none" class="small material-icons enabled right">filter_list</i></div>`


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


/**
 * Render the filters for the current features
 * @param {array of objects} features 
 */
function renderFilters(features) {
    if (!features) features=commaFeatures;
    const categories = commaExtractFeatureCategories(features);
    const types = commaExtractFeatureProperty(features, 'type');
    const tags = commaExtractFeatureTags(features);

    renderPropertyFilters(types);
    renderCategoryFilters(categories);
    renderTagFilters(tags);
    $('[data-ref="filter"]').click(filterClick);

}


// =======================================================

// handle a click on a sort
function sortClick(event) {
    let element = event.currentTarget;    
    sortProperty = element.dataset.sort;
    sortAsc = element.dataset.asc == 1;    
    $('body').removeClass(['sort-title','sort-created_date', 'sort-updated_date', 'sort-weight','sortDir-desc', 'sortDir-asc']);
    $('body').addClass('sort-'+sortProperty);
    if (sortAsc) {
        $('body').addClass('sortDir-asc');
    } else {
        $('body').addClass('sortDir-desc');
    }
    commaRender(false);
}

/**
 * Shows the home popup. 
 */
function commaShowHome(){
    commaFeatureSelect(null);
    commaHighlighterDetailSet(true);

}

/**
 * Show or hide the Detail popup
 * @param {*} show 
 * 
 */

function commaHighlighterDetailSet(show) {
    if (show) bodyElement.classList.add('showDetail', 'showFeatured');
    else {
        // remove the detail, but put the small card back
        bodyElement.classList.remove('showDetail');
        bodyElement.classList.add('showFeatured');
    }

}

/**
 * Zooms into the emlement detail. 
 * @param {*} element 
 */
function commaHighlighterDetailToggle(element) {
    //bodyElement.classList.toggle('showDetail');
    //bodyElement.classList.add('showFeatured');

    // The detail / non-detail view have been causing trouble. Removing for now. 
    commaFeatureSelect(null)
}


/**
 * Render all standard elements. 
 */
function commaRender(toast=true) {
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
    if (toast) {
        if (features.length) {
          //  M.toast({ html: $.i18n('toast_available',features.length)})
        } else {
            M.toast({ html:  $.i18n('toast_reset') })
        }
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
        // quick fix for detail  on cards view
        if (view=="cards" && selectedFeature && selectedFeature.id) {
            cardHighlight(selectedFeature.id);
        }
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
function translateTexts() {
    globals = commaGetGlobals();
    $('body').i18n();    
    // fix sort tooltips
    $("#card-sort-alpha").attr('data-tooltip',$.i18n('sort_alpha'))
    $("#card-sort-creation").attr('data-tooltip',$.i18n('sort_creation'))
    $("#card-sort-update").attr('data-tooltip',$.i18n('sort_update'))
    document.title = $.i18n('title-commnity-atlas')+ " >> " + globals.title;

}


/**
 * Enables or disables "Live mode" 
 * @param {} e 
 * @param {*} force 
 */
function liveModeClick(e, force) {  
  if (force != null) {
    commaLiveMode = e.target.checked;
  } else {
    commaLiveMode = force;
  }
  if (commaLiveMode) {
    commaLiveReloadTimer = setInterval ( commaReloadGeoData, 5000 );
    console.log('Enabled live mode');
    $('body').addClass('liveMode');
  } else {
      clearInterval(commaLiveReloadTimer)
      $('body').removeClass('liveMode');
      console.log('Disabled live mode');
  }
}

//==========================================================

$(document).ready(function () {
    bodyElement = document.getElementsByTagName('body')[0];
    $.i18n.debug = true;
    commaLanguage = commaGetConfig('lang') || "en";
    $.i18n().locale = commaLanguage;   
    $.getJSON(commaGetConfig('commaJSONUrl')).done(function (data) {
        let features = commaInitialiseFeatureData(data);
        let globals = commaGetGlobals();


        


        // perform initial rendering of all aspects so that we start will all the right data
        //viewTabEventsInit();
        //  initDrawers();
        renderFooter();
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
        commaRender(false);
        renderTools();
        //lets see if we have a valid feature selected                      
        renderHighlighter(commaFeatureFind());
        commaSetView(currentView);
        commaHighlighterDetailSet(commaGetConfig('showDetail'));


        // renderViewControls();

        $("#sidedrawer-title").click(commaShowHome);
        $("#info-icon").click(commaShowHome);
        $("#highlight-summary").click(commaHighlighterDetailToggle);
        $("[data-ref='view']").click(commaViewer);
        $("#controls-reset").click(filterResetClick);
        $("#cards-wrapper .controls .control").click(sortClick);
        $('.lang-switch').click(function (e) {
            e.preventDefault();
            $.i18n().locale = $(this).data('locale');
            commaLanguage = $(this).data('locale');
            translateTexts();
        });

        $("#control-liveMode").click(liveModeClick); 
        // Start off in live mode 
        $("#control-liveMode").trigger('click')
  
        if (typeof test === "function") {
            $('#tests').html(test());
        }

        $.i18n().load(
            {
                "en": "./commaBrowser/browser/translation/en.json",
                "de": "./commaBrowser/browser/translation/de.json",
                "it": "./commaBrowser/browser/translation/it.json",
                "pt": "./commaBrowser/browser/translation/pt.json",
            }
        ).done(translateTexts);

        
        $("nav #title").html(globals.title);
        $("#sidedrawer-title").html(globals.title);
        $("#cards-header-content").html(globals.title);
        


    });
});
