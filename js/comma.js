

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
    // filter 
    if (params && params.filter && (params.filter.type.indexOf('All') == -1)) {
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


/**
 * Returns a single feature matching a selector
 * @param {*} id 
 */
function commaGetSelected(selector) {
    let features = commaUnifyFeatures(commaGeo);
    console.log('selecting');
    let selected = features.find(function (feature) {
        console.log('id:' + feature.id);
        return feature.id == selector
    });
    return selected;
}


function GetURLParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
}

function changeUrl(url) {
    var new_url = window.location
    window.history.pushState("data", "Title", new_url);
    document.title = url;
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
    console.log(features);
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
        timeline.title.text.headline += "(" + activeType + ")"
    }
    return timeline;
}


/**
 * Render a comma json file to a timeline on specific dom element
 * @param {*} element 
 * @param {*} comma 
 */
function renderTimeline(features) {
    console.log("Rendering comma as timeline");
    let timeline = convertFeaturesToTimeline(features);
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
    return `<div class="card ${feature.properties.type} ${event} ${geo}" data-ref="card"  data-id="${feature.id}">
    <div class="image" style="background-image:url(${feature.properties.image})"></div>
    <img class="calendar" src="images/calendar.png">    
    <img class="marker" src="images/marker.png">    
    <h4><a href="#${feature.id}">${feature.properties.title}</a></h4>
    <div class="featureID">${feature.id}</div>
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
    return `<button type="button" class="mui-btn control control-filter" data-ref="filter" data-type="${type}">${type}</button>`
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
    console.log("Activeate");
    console.log(siblings);
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
    console.log("filtering by "+type);
   
    mixer.dataset(features);
    console.log(features);
    renderTimeline(features);
    let geoFeatures = commaGetFeatures({
        "filter": { "type": [type] },
        "class": "geo"
    })

    // renderMapFeatures(map, geoFeatures);
    renderLeafletFeatures(geoFeatures);

}


// ------------------------ Leaflet

var leafletMap = {};
var leafletNodeLayer = {};
var leafletFeatureLookup = {};

function renderLeaflet() {
   // L.mapbox.accessToken = mapBoxToken;
   // leafletMap = L.map('leafletMap').setView([51.505, -0.09], 13).addLayer(L.mapbox.styleLayer('mapbox://styles/mapbox/streets-v11'));
   leafletMap = L.map('leafletMap');
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
    console.log(leafletNodeLayer);
   // if (leafletNodeLayer) leafletMap.removeLayer(leafletNodeLayer);
    leafletNodeLayer = L.geoJSON(null,{
        onEachFeature: onEachFeature,
      //  style: L.mapbox.simplestyle.style
        //pointToLayer: L.mapbox.marker.style
    }).addTo(leafletMap);
    console.log('rendering map')
    console.log(features);
    leafletNodeLayer.addData(geojson);
    leafletMap.fitBounds(leafletNodeLayer.getBounds(), { padding: [20, 20] });
}



function onEachFeature(feature, layer) {
    leafletFeatureLookup[feature.id] = layer._polygonId; 
    layer.on('click', function (e) {
      console.log('feature event');
	  // does this feature have a property named popupContent?
	  if (e.target.feature.id && e.target.feature.properties.title) {
          commaHighlighter(commaGetSelected(e.target.feature.id));		
    }
});
}

//==========================================================

/**
 * 
 */
function viewTabEventsInit(){
  document.querySelector('[data-mui-controls="timeline-wrapper"]').addEventListener('mui.tabs.showend',  function(){ 
    console.log("render timeline tab");  
    // timeline does not like to be rendered hidden.??
      let features = commaGetFeatures({ "filter": { "type": [activeType] } });
      console.log("rendering timeline");
      renderTimeline(features);
   });
   document.querySelector('[data-mui-controls="map-wrapper"]').addEventListener('mui.tabs.showend',  function(){ 
    console.log("render map tab");  
    leafletMap._onResize();
   });

  
}

function initDrawers(){
        var $bodyEl = $('body'),
         $sidedrawerEl = $('#sidedrawer');
      
      
        function showSidedrawer() {
          // show overlay
          var options = {
            onclose: function() {
              $sidedrawerEl
                .removeClass('active')
                .appendTo(document.body);
            }
          };
      
          var $overlayEl = $(mui.overlay('on', options));
      
          // show element
          $sidedrawerEl.appendTo($overlayEl);
          setTimeout(function() {
            $sidedrawerEl.addClass('active');
          }, 20);
        }
      
      
        function hideSidedrawer() {
          $bodyEl.toggleClass('hide-sidedrawer');
        }
      
      
        $('.js-show-sidedrawer').on('click', showSidedrawer);
        $('.js-hide-sidedrawer').on('click', hideSidedrawer);
}

// =======================================================
function commaBrowser() {
    let globals = commaGetGlobals();
    $('#commaBrowser').addClass('active').removeClass('inactive');
    $('#commaFeature').addClass('inactive').removeClass('active');
    document.title = "Community Atlas >> "+ globals.title;
    window.location.assign("#");
    console.log("back");

}


function commaFeature(feature) {
    let globals = commaGetGlobals();
    $('#commaFeature').addClass('active').removeClass('inactive');
    $('#commaBrowser').addClass('inactive').removeClass('active');
    console.log(feature);
    $("#appbar #title").html(feature.properties.title);
    document.title = "Community Atlas >> "+globals.title + " >> " + feature.properties.title;
}


function commaHighlighter(feature) {
    console.log('highlighter'); 
    console.log(feature);
    /*
     If we don't have a feature, populate from globals
    */
    if (!feature) {
        feature = {
            'properties': commaGetGlobals(),
            'id':'all'
        }
    } 
    
    let image = feature.properties.image?feature.properties.image:'/images/marker.png';
    
    $("#highlighter-wrapper").html(
        `<img class="card-image" src="${image}" />
        <h2>${feature.properties.title}</h2> 
        <p>${feature.properties.description}</p>       
        `
    )    
    
}

function cardClick(event) {
    let featureId = event.target.dataset.id
    console.log(event.target.dataset.id);
    //window.location.assign("#" + featureId);
    //commaFeature(commaGetSelected(featureId))
    commaHighlighter(commaGetSelected(featureId));
    leafletNodeLayer.eachLayer(function(layer) {
        setHighlighted(layer, doesRelate(layer._polygonId, leafletFeatureLookup[featureId])); 
    })
}


//==========================================================

$(document).ready(function () {
    console.log("ready!");
    $.getJSON(commaJSONUrl).done(function (data) {
        commaGeo = data;
        console.log("Got data");
        let globals = commaGetGlobals();
        console.log(globals);
        viewTabEventsInit();
        initDrawers();
        renderCards(commaGetFeatures());
        renderTimeline(commaGetFeatures());
        /*
           map = renderMap(mapContainer);
           map.on('load', function () {
               renderMapFeatures(map, commaGetFeatures({ class: 'geo' }))
           });*/
        renderLeaflet();
        renderLeafletFeatures(commaGetFeatures({ class: 'geo' }))
      // renderViewControls();
        $(".card").click(cardClick);
        $('#backButton').click(commaBrowser);
        let selectedFeature = null;
        //lets see if we have a valid feature selected        
        if (selectedId = window.location.hash) {
            selectedFeature = commaGetSelected(selectedId.substr(1));
            if (selectedFeature) commaFeature(selectedFeature);
        } else {
            commaBrowser();
        }
        commaHighlighter(selectedFeature);

    });
});
