# Vessel flow viewer

Five views: vessel shape, predicted velocity, CFD reference, vector-error magnitude, and side-by-side comparison. Drag to rotate and scroll to zoom. Keyboard: 1–5 switches views, Space pauses the flow animation, R resets the camera.

The equation marked `L_planned` shows the proposed training objective: data loss plus weighted mean squared continuity and steady incompressible Navier–Stokes momentum residuals. `p_kin` is kinematic pressure, `nu` is kinematic viscosity, and angle brackets denote a spatial mean. The weights set the relative scales of the losses. This equation describes planned work; the displayed saved prediction was not trained with these added terms.

The error box shows the **full-field relative L2 velocity error**, summed over all 30,000 interior points and three vector components:

```text
100 × sqrt(sum_i ||predicted_velocity_i − CFD_velocity_i||²)
    / sqrt(sum_i ||CFD_velocity_i||²)
```

The displayed case is **training vessel 4698**, parent 258. Its 15.67% error is an example-specific training score, not held-out performance. Both velocity views use the same color scale in m/s. The error view shows the magnitude of the vector difference in m/s.

This static site displays a saved AB-GATr prediction from the project's October 8, 2026 evaluation-anchor replay. It does not execute the neural network in the browser. Animated dots illustrate direction along interpolated paths in a steady field, not time-dependent blood flow. The rendered wall is simplified and display points are subsampled; the scalar L2 score uses the complete saved field.

Data: [Aneumo, original dataset release](https://arxiv.org/abs/2505.14717v1). Model: existing [AB-GATr](https://arxiv.org/abs/2605.18816v1), through the project's local velocity adapter. Exact input/output fingerprints and display transformations are recorded in `provenance.json`.

The site is self-contained: serve this directory with any static web server. The prebuilt JavaScript includes Three.js 0.169.0 and OrbitControls. Their MIT license is included in `THREE-LICENSE.txt`. Editable viewer logic is in `src/app.js`.
