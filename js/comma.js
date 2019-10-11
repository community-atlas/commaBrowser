const commaJSONUrl = "https://raw.githubusercontent.com/the-greenman/community-atlas/master/geojson/atlas1.geojson"
const mapBoxToken = "pk.eyJ1IjoiZ3JlZW5tYW4yMyIsImEiOiJjazBrMmMwMG8wYmppM2N0azdqcnZuZzVjIn0.jpODNTgb9TIxZ6yhZKnTvg";

// create our global variable for storing our data
let commaGeo = {};




//---------------------------Utils
/**
 * Combines all features into one list
 * @param {*} comma 
 */
function commaUnifyFeatures(comma) {
    const features = comma.features.concat(comma.nonGeoFeatures);
    return features;
}

/**
 * Returns an array of feature types defined
 * 
 * @param {} features 
 */
function commaExtractFeatureTypes(features) {
    var types = features.map(function (feature) { return feature.properties.type });
    types = [...new Set(types)];
    return types;
}

/**
 * Returns a filtered and sorted version of the unified dataset 
 * @param {object } params 
 */
function commaGetFeatures(params) {
    console.log(params);
    let features = commaUnifyFeatures(commaGeo);
    if (params && params.filter && (params.filter.type.indexOf('All') == -1) ) {
        features = features.filter(function (feature) {
            let keep = params.filter.type.indexOf(feature.properties.type) !== -1;
            console.log(`${keep}: ${feature.properties.type} `)
            return keep;
        });
    }
    if (params && params.class) {
        features = features.filter(function (feature) {
            let keep = false;
            if (params.class == 'geo') { keep = feature.hasOwnProperty('geometry') }
            return keep;
        });
    }
    console.log(features);
    return features;
}

function commaGetGlobals() {
    return commaGeo.properties;
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


        console.log(event);
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
            },
        },
    }

    if (activeType !== 'All') {
        timeline.title.text.headline+= "("+activeType+")"
    }
    return timeline;
}


/**
 * Render a comma json file to a timeline on specific dom element
 * @param {*} element 
 * @param {*} comma 
 */
function renderTimeline(element, features) {
    console.log("Rendering comma as timeline");
    const timeline = convertFeaturesToTimeline(features);
    console.log(JSON.stringify(timeline));
    window.timeline = new TL.Timeline('timeline-embed', timeline, { debug: false });
}



//---------------------------- MIXITUP --- CARD VIEW

const container = document.querySelector('[data-ref="container"]');
var firstGap = document.querySelector('[data-ref="first-gap"]');

var controls = document.querySelector('[data-ref="controls"]');
var filters = document.querySelectorAll('[data-ref="filter"]');
var sorts = document.querySelectorAll('[data-ref="sort"]');

var activeType = 'All';

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


function renderCard(feature) {
    console.log((feature.geometry !== null))
    let event = feature.properties.start_date ? 'event' : '';
    let geo = (feature.hasOwnProperty('geometry')) ? 'geo' : '';
    return `<div class="card ${feature.properties.type} ${event} ${geo}" data-ref="card">
    <div class="image" style="background-image:url(${feature.properties.image})"></div>
    <img class="calendar" src="images/calendar.png">    
    <img class="marker" src="images/marker.png">    
    <h4>${feature.properties.title}</h4>
    
    </div>`;
}


function renderCards(features) {
    const types = commaExtractFeatureTypes(features);
    renderFilters(types);


    // We can now set up a handler to listen for "click" events on our UI buttons

    controls.addEventListener('click', function (e) {
        handleButtonClick(e.target);
    });

    // Set controls the active controls on startup to match the default filter and sort

    activateButton(controls.querySelector('[data-type="All"]'), filters);
    activateButton(controls.querySelector('[data-order="asc"]'), sorts);

    console.log(features);
    console.log(types);
    mixer.dataset(features);
}

function renderFilter(type) {
    return `<button type="button" class="control control-filter" data-ref="filter" data-type="${type}">${type}</button>`
}

function renderFilters(categories) {
    const filters = categories.map(renderFilter);
    filters.push(renderFilter('All'));
    console.log(filters);
    $('#controls').html(filters.concat());
}


/**
            * A helper function to set an active styling class on an active button,
            * and remove it from its siblings at the same time.
            *
            * @param {HTMLElement} activeButton
            * @param {HTMLELement[]} siblings
            * @return {void}
            */

function activateButton(activeButton, siblings) {
    var button;
    var i;
    for (i = 0; i < siblings.length; i++) {
        button = siblings[i];

        button.classList[button === activeButton ? 'add' : 'remove']('control-active');
    }
}

/**
 * A click handler to detect the type of button clicked, read off the
 * relevent attributes, call the API, and trigger a dataset operation.
 *
 * @param   {HTMLElement} button
 * @return  {void}
 */

function handleButtonClick(button) {
    // Define default values for color, sortBy and order
    // incase they are not present in the clicked button

    var type = activeType;
    var sortBy = 'id';
    var order = 'asc';

    // If button is already active, or an operation is in progress, ignore the click

    if (button.classList.contains('control-active') || mixer.isMixing()) return;

    // Else, check what type of button it is, if any

    if (button.matches('[data-ref="filter"]')) {
        // Filter button

        activateButton(button, filters);

        type = activeType = button.getAttribute('data-type');
    } else if (button.matches('[data-ref="sort"]')) {
        // Sort button

        activateButton(button, sorts);

        sortBy = button.getAttribute('data-key');
        order = button.getAttribute('data-order');
    } else {
        // Not a button

        return;
    }

    let features = commaGetFeatures({ "filter": { "type": [type] } });
    mixer.dataset(features);
    renderTimeline('timeline-embed', features);
   let geoFeatures = commaGetFeatures({ 
    "filter": { "type": [type] }, 
    "class":"geo" 
    })

   // renderMapFeatures(map, geoFeatures);
    renderLeafletFeatures(geoFeatures);

}

//----------------------------Map

const mapContainer = "map";
mapboxgl.accessToken = mapBoxToken;
var map = {};

function renderMap(container) {
    var myMap = new mapboxgl.Map({
        "container": container,
         /*style: {
             "version": 8,
             "sources": {
             "raster-tiles": {
             "type": "raster",
             "tiles": ["https://stamen-tiles.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg"],
             "tileSize": 256,
             "attribution": 'Map tiles by <a target="_top" rel="noopener" href="http://stamen.com">Stamen Design</a>, under <a target="_top" rel="noopener" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a target="_top" rel="noopener" href="http://openstreetmap.org">OpenStreetMap</a>, under <a target="_top" rel="noopener" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>'
             }
             },
             "layers": [{
             "id": "simple-tiles",
             "type": "raster",
             "source": "raster-tiles",
             "minzoom": 0,
             "maxzoom": 22
             }]
             },*/
        style: 'mapbox://styles/mapbox/streets-v9',
        //center: [13.39, 52.49],
        //zoom: 10,
    });
    var geojson = {
        "type": "FeatureCollection",
        "features": []
    };
    myMap.on('load', function () {
        myMap.addSource('nodes', { type: 'geojson', data: geojson });
        myMap.addLayer({
            "id": "points",
            "type": "circle",
            "source": "nodes",
            "paint": {
                "circle-radius": 6,
                "circle-color": "#B42222"
            },
            filter: ['in', '$type', 'Point'] // only show points
        });       
        map.addLayer({
            "id": "lines",
            "type": "line",
            "source": "nodes",
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            },
            paint: {
                'line-color': '#000',
                'line-width': 2.5
            },
            filter: ['in', '$type', 'LineString'] // find the lines     
        });
    });
    //@todo: add polygons
    return myMap;
}

function renderMapFeatures(map, features) {

    // find the right zoom
    let bounds = new mapboxgl.LngLatBounds();
    
    features.forEach(function (feature) {
        bounds.extend(feature.geometry.coordinates);
    });
    const geojson = {
        "type": "FeatureCollection",
        "features": features
    }; 
    // add it to the map
    map.getSource('nodes').setData(geojson);
    map.fitBounds(bounds, { padding: 120 });

}


// ------------------------ Leaflet

var leafletMap = {};
var leafletNodeLayer = {};

function renderLeaflet(){
    leafletMap = L.map('leafletMap').setView([51.505, -0.09], 13);
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox.streets',
        accessToken: mapBoxToken
    }).addTo(leafletMap);
    
}


function renderLeafletFeatures(features) {
    var bounds = new L.LatLngBounds();
    features.forEach(function (feature) {
        bounds.extend(feature.geometry.coordinates);
    });
    const geojson = {
        "type": "FeatureCollection",
        "features": features
    }; 
    if (leafletNodeLayer) leafletMap.removeLayer(leafletNodeLayer);
    leafletNodeLayer = L.geoJSON().addTo(leafletMap);
    leafletNodeLayer.addData(geojson);
    // add it to the map    
    //leafletMap.fitBounds(bounds, { padding: 120 });
    leafletMap.fitBounds(leafletNodeLayer.getBounds(), { padding: [20, 20] });
}


//==========================================================

var views = document.querySelector('[data-ref="views"]');
var activeView = "map"; // set the map as default view

function renderViewControls(){
    // We can now set up a handler to listen for "click" events on our UI buttons

    views.addEventListener('click', function (e) {
        toggleViewer(e.target);
    });
    console.log(views);
}

function toggleViewer(button){
    console.log("toggel view");
    console.log(button);
    var view = activeView;
       // If button is already active, or an operation is in progress, ignore the click

    if (button.classList.contains('control-active')) return;

    // Else, check what type of button it is, if any

    if (button.matches('[data-ref="view"]')) {
        // Filter button

        activateButton(button, views);

        view = activeview = button.getAttribute('data-type');

        if (view=='map') {
           $("#timeline-wrapper").addClass('inactive');
           $("#map-wrapper").removeClass('inactive');
           leafletMap._onResize(); 

        } else if (view=="timeline") {
            $("#timeline-wrapper").removeClass('inactive');
            $("#map-wrapper").addClass('inactive');
             // timeline does not like to be rendered hidden.??
            let features = commaGetFeatures({ "filter": { "type": [activeType] } });   
          console.log("rendering timeline");     
          renderTimeline('timeline-embed', features);

        }
    }  else {
        // Not a button

        return;
    }

}
//==========================================================

$(document).ready(function () {
    console.log("ready!");
    $.getJSON(commaJSONUrl).done(function (data) {
        commaGeo = data;
        console.log("Got data");
        let globals = commaGetGlobals();
        console.log(globals);
        $("#title").html(globals.title);

        renderCards(commaGetFeatures());
        renderTimeline('timeline-embed', commaGetFeatures());
     /*
        map = renderMap(mapContainer);
        map.on('load', function () {
            renderMapFeatures(map, commaGetFeatures({ class: 'geo' }))
        });*/
       renderLeaflet();
       renderLeafletFeatures(commaGetFeatures({ class: 'geo' })) 
       renderViewControls();
    });
});
