//--------------------------------------------------------------------- Globals
// create our global variable for storing our data
let commaGeo = {}; // the raw data
let commaFeatures = []; // processed Features
// store our global filterset
let filters = {};
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

//---------------------------Utils

/**
 * Returns the relevant config 
 * @param {*} key 
 */
function commaGetConfig(key){

    function getLocalConfig(){                
        let configDomain = null; 
        let urlParameters = new URLSearchParams(document.URL.search);
        let configKeys = Object.keys(CONFIG);


        if (!(configDomain = urlParameters.get("atlas")))  {
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
function commaInitialiseGeoData(geoData) {
    commaGeo = geoData;  
    features = commaUnifyFeatures(geoData);
    features = geoData.features.map(commaFeatureFill);
    commaFeatures = features; 
    return features;
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
      if (geometry = feature.geometry.coordinates) {
         if (Array.isArray(geometry[0])) {
             geometry = geometry[0][0];
         }
         feature.properties.image=`https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/${geometry[0]},${geometry[1]},13,0,0/400x300?access_token=pk.eyJ1IjoiZ3JlZW5tYW4yMyIsImEiOiJjazBrMmI1enMwZmkwM2dsaWg3emJnODg1In0.kD8yI6unRQOrVzNY-07-tg`
      }
      
  }


  let propertyDefaults = {
      "type" : '',
      "description" : "",      
  }

  feature.properties = {...propertyDefaults, ...feature.properties}
  feature.properties.description = feature.properties.description.replace(/\n/g, "<br />") || '';  
  return feature; 
}


/**
 * Combines all features into one list
 * @param {*} comma 
 */
function commaUnifyFeatures(comma) {
    const features = comma.features.concat(comma.nonGeoFeatures);
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
               'key':Object.keys(categories).length+1,
           }
       }    
    });
    return categories;
}


/**
 * Returns a filtered and sorted version of the unified dataset 
 * @param {object } params 
 */
function commaGetFeatures(params=false,localFilters = false) {    
    let features = commaFeatures;
    // filter the features
    if (!localFilters) localFilters=filters;        
    features = features.filter(function (feature) {
        let keep = true;
        Object.keys(localFilters).forEach(property => {
            if (                
                localFilters[property].indexOf(feature.properties[property]) == -1) keep=false;              
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



function commaGetGlobals() {
    let defaults = {
      type:'Community atlas',
    };    
    return {...defaults, ...commaGeo.properties}
}

/**
 * Sets the current selected feature
 * 
 * @param {object} feature 
 */
function commaFeatureSelect(selector){
  // if selector is already selected, we toggle
  if (selectedFeature && selectedFeature.id == selector) selectedFeature = null 
  else selectedFeature = commaFeatureFind(selector);
  // get the id 
  let id = null;
  if (selectedFeature) id = selectedFeature.id;  
  // update highligher
  commaHighlighter(selectedFeature);
  // update map
  leafletHighightMarker(id);    
  // update cards
  cardHighlight(id);
  commaUrlPush();
  if (id) {
    bodyElement.classList.add('showFeatured');
    if (currentView!=='map') bodyElement.classList.add('showDetail');  // force detail if we are not on the map
  }
  else {
      bodyElement.classList.remove('showFeatured');
      if (currentView!=='map') bodyElement.classList.remove('showDetail');  // force detail if we are not on the map
  }
}

/**
 * Returns a single feature matching a selector
 * @param {*} id 
 */
function commaFeatureFind(selector = null) {   
    let selected = null;
    if (!selector || (selectedFeature && selector == selectedFeature.id )) {
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
    const filterHash = filterEncode(filters);
    const selectedHash = selectedFeature?"/"+encodeURIComponent(selectedFeature.id):'';
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
    if (components[0].length) {
        commaSetView(components[0]);
    } 
    if (components[1].length) {
        filters = filterDecode(components[1]);
        filterChange = true; 

    }
    if (components[2]) {
        selectedFeature = commaFeatureFind(decodeURIComponent(components[1]))
    } 
  }
  return filterChange;
}

function commaRender(){
    let features = commaGetFeatures();
    mixer.dataset(features);    
    renderTimeline(features);
    let geoFeatures = commaGetFeatures({        
        "class": "geo"
    })
    // renderMapFeatures(map, geoFeatures);
    renderLeafletFeatures(geoFeatures);
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
    let timeline = convertFeaturesToTimeline(features);
    window.timeline = new TL.Timeline('timeline-embed', timeline, { debug: false });
}



//---------------------------- MIXITUP --- CARD VIEW

const container = document.querySelector('[data-ref="container"]');
var firstGap = document.querySelector('[data-ref="first-gap"]');

var controls = document.querySelector('[data-ref="controls"]');
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
    let event = feature.properties.start_date ? 'event' : '';
    let geo = (feature.hasOwnProperty('geometry')) ? 'geo' : '';
    return `<div class="card small hoverable  ${feature.properties.type} ${event} ${geo}" data-ref="card"  data-id="${feature.id}">
    <div class="card-image blue-grey darken-1 waves-effect waves-block waves-light">
    <img src="${feature.properties.image}">
    </div>
    
        <div class="card-content">
            <span class="card-title activator grey-text text-darken-4"><i class="material-icons right">more_vert</i>${feature.properties.title}</span>
        </div>
        <div class="card-action">
          <i class="small material-icons date" alt="Feature appears in timeline">date_range</i>
          <i class="small material-icons map" alt="Feature appears on map">map</i>

        </div>
        <div class="card-reveal">
            <span class="card-title grey-text text-darken-4"><i class="material-icons right">close</i>${feature.properties.title}</span>
            <p >${feature.properties.description}</p>
        </div>    
    </div>`;
}

function cardHighlight(selector) {
    let selected = document.querySelector('.card.active');
    if (selected) selected.classList.remove('active');
    if (selector)  document.querySelector("[data-id='"+selector+"']").classList.add('active');
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
    };
    console.log(leafletNodeLayer);
   if (leafletNodeLayer) leafletMap.removeLayer(leafletNodeLayer);
    leafletNodeLayer = L.geoJSON(null,{
        onEachFeature: mapOnEachFeaturePoints,
      //  style: L.mapbox.simplestyle.style
        //pointToLayer: L.mapbox.marker.style
        filter: function(feature){return feature.geometry.type.toLowerCase() == 'point'}
    }); // .addTo(leafletMap);

    if (leafletPolygonLayer) leafletMap.removeLayer(leafletPolygonLayer);
    leafletPolygonLayer = L.geoJSON(null,{
        onEachFeature: mapOnEachFeaturePoly,
      //  style: L.mapbox.simplestyle.style
        //pointToLayer: L.mapbox.marker.style
        filter: function(feature){return feature.geometry.type.toLowerCase() != 'point'}
    }).addTo(leafletMap);

    
    console.log('rendering map')
    //console.log(features);
    leafletNodeLayer.addData(geojson);
    leafletPolygonLayer.addData(geojson);
    
    // clustering
    if (leafletClusterLayer) leafletMap.removeLayer(leafletClusterLayer);
    leafletClusterLayer = L.markerClusterGroup();
    leafletClusterLayer.addLayer(leafletNodeLayer);
    leafletMap.addLayer(leafletClusterLayer);


    // make sure that we get the right bounds for our data
    let bounds = leafletNodeLayer.getBounds();
    let polyBounds = leafletPolygonLayer.getBounds();
    bounds.extend(polyBounds.getNorthEast());
    bounds.extend(polyBounds.getSouthWest());
    leafletMap.fitBounds(bounds, { padding: [20, 20] });
}




var greenIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  var blueIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });


  /**
   * Event handler for map move event
   * @param {*} event 
   */

  function mapOnMove(event){
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
      mapResetMarkers();
      clickedIcon = e.target.icon;
      clickedMarker = e.target;
      e.target.setIcon(greenIcon);
	  // does this feature have a property named popupContent?
	  if (e.target.feature.id && e.target.feature.properties.title) {
        commaFeatureSelect(e.target.feature.id);          
    }
});
}

function mapOnEachFeaturePoly(feature,layer){
    // store a reference
    mapFeaturePolyLookup[feature.id] = L.stamp(layer); 
    layer.on('click', e => {
        mapResetMarkers();        
        clickedPoly = e.target;
        clickedPolyColor = e.target.options.color;
        clickedPoly.setStyle({'color':'#ff3333'});
        commaFeatureSelect(e.target.feature.id);          
    });
}

/**
 * Reset any currently highlighed map features 
 * */
function mapResetMarkers() {
    if (clickedPoly) { 
        clickedPoly.setStyle({'color':clickedPolyColor});
    }    
    if (clickedMarker) {
        clickedMarker.setIcon(blueIcon);
    }
}

/**
 * Highlight the currently selected marker
 * @todo Unify highlighting
 * @param {string} featureId 
 */
function leafletHighightMarker(featureId) {  
  //reset the current marker
  mapResetMarkers();
    if (featureId) {
        let _leaflet_id = leafletFeatureLookup[featureId];  
        if (_leaflet_id) {
            
            leafletMap.eachLayer(function(layer) {
                if(layer._leaflet_id == _leaflet_id) {                                
                    clickedMarker = layer;
                    layer.setIcon(greenIcon); 
                }
            });
        } 
        else if (_leaflet_id = mapFeaturePolyLookup[featureId]) {            
            leafletMap.eachLayer(function(layer) {
                if(layer._leaflet_id == _leaflet_id) {                                
                    clickedPoly = layer;
                    clickedPolyColor = layer.options.color;
                    clickedPoly.setStyle({'color':'#ff3333'});
                }
            });
            
        }
    }
}

// ======================== Filters

// returns the current filters
function filterGet(){
    return filters;
}

// set the state of a filter
function filterSet(attribute, value, state) {
  if (filters[attribute]) {
      let index = filters[attribute].indexOf(value);
      if (state && index == -1) {
        filters[attribute].push(value);
      } else if (!state && index !== -1) {
          // remove the value 
          if (filters[attribute].length==1) {
              delete filters[attribute];
          } else {
            filters[attribute].splice(index,1);
          }            
      }
  } else if (!filters[attribute] && state) {
      // Add a new property
      filters[attribute]=[value];
  }
 }

// handle a click on a filter
function filterClick(element){
  let state = !element.classList.contains('active');
  Object.keys(element.dataset).forEach(attribute => {
      if (attribute != "ref") filterSet(attribute, element.dataset[attribute],state);
      
  });
  filterDisplayUpdate(filters);
  commaUrlPush();
  commaRender();
}

// Update all filter elements with the active class
function filterDisplayUpdate(localFilters = null){
   if (!localFilters) localFilters= filters;
   let elements = document.querySelectorAll('[data-ref="filter"]');
   elements.forEach(element => {
     element.classList.remove('active');
     Object.keys(localFilters).forEach(property => {
       if (localFilters[property].includes(element.dataset[property])) element.classList.add('active')       
    });
  });
}


/**
 * Returns a string that can be used in the url hash
 * @param {object} filters 
 */
function filterEncode(filters) {
    let path = Object.keys(filters).map(filter => {
        if (filters[filter]) {
            let encoded = filters[filter].map(encodeURIComponent)
            return encodeURIComponent(filter)+":"+encoded.join(',')
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
      filters[decodeURIComponent(propertyFilter[0])]=propertyFilter[1].split(',').map(decodeURIComponent);
  });
  return filters;
}

/**
 * Renders a set of simple filters for a given property
 * @param { array } values  An array of possible values
 * @param { string } property   The name of the property being filtered
 */
function renderPropertyFilters(values,property = 'type' ) {
    
    function renderFilter(value) {
        return `<div class="chip control-filter control-filter-${property}" 
        data-ref="filter" data-${property}="${value}" >${value}</div>`
    }
    const filters = values.map(renderFilter);    
    $('#controls-'+property).html(filters.join(''));
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
          
                      
           return `<div class="chip control-filter control-filter-${property}" 
           data-ref="filter" data-${property}="${value.category}"  title="${value.description}">${value.category}</div>`


        }    
        
        const property = 'category';
        const filters = Object.keys(values).map(renderFilter).join('');                
        const content = filters;
        console.log(content);
        $('#controls-category').html(content);    
}


function renderFilters(features) {
  const categories = commaExtractFeatureCategories(features);
  const types = commaExtractFeatureProperty(features,'type');
  renderPropertyFilters(types);
  renderCategoryFilters(categories);
  const filterControls = document.querySelectorAll('[data-ref="filter"]');
    // We can now set up a handler to listen for "click" events on our UI buttons

    filterControls.forEach(control => {
        control.addEventListener('click', function (e) {
            filterClick(e.target);
        });
    }); 
}

//==========================================================

/**
 * handle the re-rednering of map and timeline when the tab changes with new filters
 */
function materializeTabs(e){
   //@todo: check active tab
    // timeline does not like to be rendered hidden.??
    let features = commaGetFeatures();
    renderTimeline(features);
    leafletMap._onResize();  
}

/**
 * Initialise the matarialize interface features
 */
function initMaterialize(){
    M.AutoInit();
    let tabElement = document.querySelector('.tabs')
    var tabs = M.Tabs.init(tabElement, {'onShow':materializeTabs});
}
// =======================================================


function commaHighlighter(feature) {    
    /*
     If we don't have a feature, populate from globals
    */
    if (!feature) {
        feature = {
            'properties': commaGetGlobals(),
            'id':'all'
        }
    }     
    let image = feature.properties.image?feature.properties.image:'../images/marker.png';
    let event = feature.properties.start_date ? 'event' : '';
    let geo = (feature.hasOwnProperty('geometry')) ? 'geo' : '';

    $("#highlight-summary").html(
        `<div class="card-image"><i class="material-icons left zoomClose">arrow_back</i><img src="${image}" /></div>
        <h2><i class="material-icons right zoomOpen">arrow_forward</i>${feature.properties.title}</h2>         
        `
    )
    let fields = {
        type: 'Type',
        'start': 'Start',
        'end': 'End',
        'category': 'Category',
        'subcategory': 'Sub category',

    }
    let properties = feature.properties;
    $("#highlight-detail").html(`
        <div id="highlight-detail-properties" class="${geo} ${event}">
        <ul class="collection">
            <li class="collection-item avatar">
                <i class="material-icons circle small">folder</i>
                <span class="type">${properties.type}</span>
            </li>
            <li class="collection-item avatar">
                <i class="material-icons circle small">layers</i>
                <span class="title">${properties.category}</span>
                <p>${properties['sub-category']}</p>
            </li>
            <li class="collection-item avatar event small">
                <i class="material-icons circle">date_range</i>
                <p>
                    ${fields.start} : ${properties.start_date}<br\>
                    ${fields.end} : ${properties.end_date}<br\>
                </p>
            </li>
        </ul>
        </div>
        <div id="highlight=detail-description">        
            <p class="description">${properties.description}<p>
        </div>
        
    `)        
}





function commaHighlighterDetailSet(show) {
    if (show) bodyElement.classList.add('showDetail','showFeatured');  
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
function commaHighlighterDetailToggle(element){
    bodyElement.classList.toggle('showDetail');  
    bodyElement.classList.add('showFeatured');  
}


/**
 * Onclick handler for view change
 * @param {object} element 
 */
function commaViewer(element){
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
        if (bodyElement.classList.length>0) bodyElement.classList.remove('viewMap','viewTimeline','viewCards');                
        bodyElement.classList.add(cssClass);

        if (view == 'timeline' )  { 
            renderTimeline(commaFeatures);
        }
        else if (view == 'map') {
          leafletMap._onResize();  
        }
        currentView = view; 
        commaUrlPush();
    }
    
}


//==========================================================

$(document).ready(function () {
    bodyElement = document.getElementsByTagName('body')[0];

       $.getJSON(commaGetConfig('commaJSONUrl')).done(function (data) {
        commaInitialiseGeoData(data);

        let globals = commaGetGlobals();                    
        document.title = "Community Atlas >> "+globals.title; 
        $("nav #title").html(globals.title);
        $("#cards-header-content").html(globals.title);


        // perform initial rendering of all aspects so that we start will all the right data
        //viewTabEventsInit();
      //  initDrawers();
        
        renderFilters(commaFeatures); 
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
        //lets see if we have a valid feature selected                      
        commaHighlighter(commaFeatureFind());
        commaSetView(currentView);
        commaHighlighterDetailSet(commaGetConfig('showDetail'));


    
      // renderViewControls();
      $(".card-image").click(cardClick);
      $("#highlight-summary").click(commaHighlighterDetailToggle);        
      $("[data-ref='view']").click(commaViewer);   


    });
});