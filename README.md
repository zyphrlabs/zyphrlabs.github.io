# Zyphr

A minimal, pure-black landing page with a real-time iridescent chrome sculpture.

## Preview

No build or package installation is required. From this directory, run:

```sh
python3 -m http.server 8123
```

Open http://localhost:8123. Use an HTTP server rather than opening `index.html` directly, because the 3D scene uses JavaScript modules.

## Design and interaction

- True black background, silver typography, studio-lit metal, and a responsive layout.
- A continuously breathing metal orb with flowing surface currents, gentle rotation, iridescent reflections, and pointer-driven surface ripples, attraction, and rotation.
- The pause/play button controls ambient motion. Reduced-motion preferences start the scene paused. Rendering sleeps when the sculpture is offscreen or the tab is hidden.
- The orb appears at its final size with no growth or scale animation, and there is no static stand-in image. The canvas starts rendering on its first frame from a procedural studio, then fades up from the black background over 1.4 seconds, so the photographic environment and foil texture normally arrive while the surface is still dim and their upgrade is not visible.
- The selected Full foil finish is fixed at 80% iridescence. Temporary comparison controls have been removed; previous browser preferences no longer affect the finish.

## Files

- `index.html`: minimal hero, launch note, and one footer contact link.
- `styles.css`: typography, layout, breakpoints, and the canvas fade-in.
- `app.js`: physical metal material, custom studio reflections, living surface displacement, prismatic reflection treatment, the fixed Full foil finish, and motion controls.
- `vendor/`: Three.js r166.1 and its RGBE loader, vendored locally under the MIT license.
- `assets/iridescent-foil.png`: the supplied holographic foil reference, sampled across the surface for flowing color and detail.
- `assets/studio-small-09.hdr`: Studio Small 09 by Poly Haven, licensed CC0, lightly masked at load time to retain neutral chrome reflections with an iridescent accent. A procedural studio supplies reflections if it cannot load.

The hero reads “Building the future.” with “Unveiling soon.” underneath. A single plain-text “Get in touch” link appears in the footer on desktop and mobile and opens an email to hello@zyphrlabs.com.

Google Fonts supplies Inter and Space Grotesk; system sans-serif fonts are used if fonts cannot load.

## Deployment

Live at https://zyphrlabs.github.io/.

The existing `.github/workflows/pages.yml` publishes this static directory to GitHub Pages on pushes to `main` or manual dispatch. There is no build step.

Because the site is served from the repository root, every asset reference must stay relative. Absolute paths such as `/assets/iridescent-foil.png` resolve against the domain root and will 404 if the site is ever moved into a project subdirectory.
