
function testFeatureLoading(){
    let results = [];
    results.push(AE('Unified feature count', commaFeatures.length,29)); 
    results.push(AE('original feature count', commaGeo.features.length,19)); 
    results.push(AE('original nongeofeature count', commaGeo.nonGeoFeatures.length,10)); 
    return results; 
}



function AE(name, input, desire){
    let result = (input == desire); 
    return {
        'result': result,
        'test': name,  
        'input': input,
        'desire': desire,
    } 
} 

function test(){
    let results = testFeatureLoading();
    let output = results.map(result =>{
        let css = (result.result?"pass":"fail");
       return `<div class="result ${css}">${result.test}: got ${result.input} wanted ${result.desire}</div>`;
    })
    return `<div id="test-results">${output}</div>`;
}

