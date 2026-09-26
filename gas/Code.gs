function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('DriveLLM Diagnostics');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
