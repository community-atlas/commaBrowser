const commaJSONUrl = "https://raw.githubusercontent.com/the-greenman/community-atlas/master/geojson/atlas1.geojson"
const mapBoxToken = "pk.eyJ1IjoiZ3JlZW5tYW4yMyIsImEiOiJjazBrMmMwMG8wYmppM2N0azdqcnZuZzVjIn0.jpODNTgb9TIxZ6yhZKnTvg";

// create our global variable for storing our data
let commaGeo = {};
// store our global filterset
var filters = {};
// The currently selected feature
let selectedFeature = null;


//---------------------------Utils
/** */


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
    let features = commaUnifyFeatures(commaGeo);
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
    return commaGeo.properties;
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
        let features = commaUnifyFeatures(commaGeo);    
        selected = features.find(function (feature) {        
            return feature.id == selector
        });        
    } 
    return selected;
}




function commaUrlPush() {
    const filterHash = filterEncode(filters);
    const selectedHash = selectedFeature?"/"+encodeURIComponent(selectedFeature.id):'';
    const url = '#' + filterHash + selectedHash;
    window.location.assign(url);
}

/**
 * Retrieve settings from the URL
 */
function commaUrlPop() {
  const hash = window.location.hash.substr(1);
  console.log(hash);
  if (hash) {
    const components = hash.split('/');
    console.log(components[0]);
    if (components[0].length) {
        filters = filterDecode(components[0]);
    }
    if (components[1]) {
        console.log("select:"+components[1]);
        selectedFeature = commaFeatureFind(decodeURIComponent(components[1]))
    } 
  }
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

var leafletMap = {};
var leafletNodeLayer = {};
var leafletPolygonLayer = {};
var leafletClusterLayer = {};
var leafletLayerGroup = {};
var leafletFeatureLookup = {};

function renderLeaflet() {
   // L.mapbox.accessToken = mapBoxToken;
   // leafletMap = L.map('leafletMap').setView([51.505, -0.09], 13).addLayer(L.mapbox.styleLayer('mapbox://styles/mapbox/streets-v11'));
   // leafletMap = L.Wrld.map('leafletMap', '68e0ce6179ac3f8ae3df7a9949927879');
  leafletMap = L.map('leafletMap');
   L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox.streets',
        accessToken: mapBoxToken
    }).addTo(leafletMap);     
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


var clickedMarker;
var clickedIcon;

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

var clickedPoly;
var clickedPolyColor;
let mapFeaturePolyLookup = {};

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
  console.log(filters);
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

function initDrawers(){
        var $bodyEl = $('body'),
         $sidedrawerEl = $('#sidedrawer');
         $zoomdrawerEl = $('#zoomdrawer');
      
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
      
        function showZoomdrawer() {
            console.log('zoom');
            // show overlay
            var options = {
              onclose: function() {
                $zoomdrawerEl
                  .removeClass('active')
                  .appendTo(document.body);
              }
            };
        
            var $overlayEl = $(mui.overlay('on', options));
        
            // show element
            $zoomdrawerEl.appendTo($overlayEl);
            setTimeout(function() {
              $zoomdrawerEl.addClass('active');
            }, 20);
          }
        
        
          function hideZoomdrawer() {
            console.log('unzoom');
            $bodyEl.toggleClass('hide-zoomdrawer');
          }
        
      
        $('.js-show-sidedrawer').on('click', showSidedrawer);
        $('.js-hide-sidedrawer').on('click', hideSidedrawer);
        
        
        $('.js-show-zoomdrawer').on('click', showZoomdrawer);
        $('.js-hide-zoomdrawer').on('click', hideZoomdrawer);

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
function commaBrowser() {
    let globals = commaGetGlobals();
    $('#commaBrowser').addClass('active').removeClass('inactive');
    $('#commaFeature').addClass('inactive').removeClass('active');
    document.title = "Community Atlas >> "+globals.title; 

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
    
    let description = feature.properties.description.slice(0,255) + "..." || '';
    $("#highlight-content").html(
        `<img class="card-image" src="${image}" />
        <h2>${feature.properties.title}</h2> 
        <p>${description}</p>       
        `
    )    
    
}



//==========================================================

$(document).ready(function () {
       $.getJSON(commaJSONUrl).done(function (data) {
        commaGeo = data;
        let globals = commaGetGlobals();        
        let allFeatures = commaGetFeatures({},{}); // Pass two empty filter objects to make sure we get all data       
        document.title = "Community Atlas >> "+globals.title; 
        $("nav #title").html(globals.title);
        $("#cards-header-content").html(globals.title);


        // perform initial rendering of all aspects so that we start will all the right data
        //viewTabEventsInit();
      //  initDrawers();
        
        renderFilters(allFeatures); 
        renderCards(allFeatures);
        renderTimeline(commaGetFeatures());        
        renderLeaflet();
        renderLeafletFeatures(commaGetFeatures({ class: 'geo' }));
        
        // Now, if there are any updates pushed from the url or config update the display
        commaUrlPop(); 
        filterDisplayUpdate();
        commaRender();
        initMaterialize();
        

      // renderViewControls();
        $(".card-image").click(cardClick);
      //  $('#backButton').click(commaBrowser);       
        //lets see if we have a valid feature selected                      
        commaHighlighter(commaFeatureFind());

    });
});
