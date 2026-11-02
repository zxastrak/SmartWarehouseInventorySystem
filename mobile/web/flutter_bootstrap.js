{{flutter_js}}
{{flutter_build_config}}

const loaderContainer = document.getElementById("loader_container");

_flutter.loader.load({
  onEntrypointLoaded: async function(engineInitializer) {
    const appRunner = await engineInitializer.initializeEngine();
    
    if (loaderContainer) {
      loaderContainer.style.opacity = '0';
      setTimeout(() => {
        try {
          loaderContainer.remove();
        } catch (_) {}
      }, 450);
    }

    await appRunner.runApp();
  }
});

