const commaJSONUrl = "https://raw.githubusercontent.com/the-greenman/community-atlas/master/geojson/atlas1.geojson"

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
        if(feature.properties.image) event.background = {"url" :feature.properties.image};
        if(feature.properties.image) event.media = {"url" :feature.properties.image};

        
        console.log(event);
        return event;
    }
}

/**
 * Convert a comma json file to the KnightLabs Json format
 * @param {
 * } comma 
 */

function convertCommaToTimeline(comma) {
    const features = comma.features.concat(comma.nonGeoFeatures);
    let events = features.map(createTimelineEvent);
    events = events.filter(x => x);

    const timeline = {
        "events": events,
        "title": {
            'text': {
                'headline': comma.properties.title,
            },
        },
    }
    return timeline;
}

function renderTimeline(element, comma) {
    console.log("Rendering comma as timeline");
    const timeline = convertCommaToTimeline(comma);
    console.log(JSON.stringify(timeline));
    window.timeline = new TL.Timeline('timeline-embed', timeline, { debug: true });
}

$(document).ready(function () {
    console.log("ready!");
    $.getJSON(commaJSONUrl).done(function (data) {
        console.log("Got data");
        renderTimeline('timeline-embed', data);
    });
});
