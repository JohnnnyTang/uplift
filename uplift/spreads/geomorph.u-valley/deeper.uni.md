<!-- expert-review -->

<!-- claims: C11, C12 | sources: CP10; Wee57; Nye65; HHR88; Sed09; Model; Results -->

**Ice flow.** The glacier is a vertically integrated ice thickness on the bed, flowing by the shallow-ice approximation with Glen's flow law and Weertman sliding (CP10; Wee57). Plain shallow ice keeps a V, because stress peaks on the valley axis (Sed09; Results). A lateral-drag shape factor, estimated from the cross-section geometry, lets the walls carry part of the driving stress: sliding has a minimum on the axis and maxima on the lower walls (Nye65; HHR88; Model). It is a geometric estimate, not a higher-order stress solution.

<!-- claims: C2 | sources: Hal79; Her15; Model -->

**Erosion.** Under ice, the bed is lowered at a rate proportional to a power of the basal sliding speed, scaled by the rock's erodibility (Hal79; Her15; Model). Erosion at the reference sliding speed {{probe.referenceSliding}} is {{probe.erosionAtReference}} before time compression; erosion-law exponent {{probe.erosionExponent}}, sliding-law exponent {{probe.slidingExponent}}. Sliding and erosion see at most {{probe.maxSlidingStress}} of basal stress. Ice thinner than {{probe.slidingOnset}} is frozen to its bed and does not slide; sliding is full from {{probe.fullSliding}}.

<!-- claims: C10 | sources: Model; Oer01 -->

**Ice supply and time.** Snow accumulates above a fixed snowline at {{probe.snowline}} and melts below it, with a mass-balance gradient of {{probe.massBalanceGradient}} and at most {{probe.maxAccumulation}} of accumulation (Oer01; Model). The snowline is a fixed teaching choice, not a reader control, and is read on the starting bed so every rock gets the same ice. Model time advances in fixed steps of {{probe.timeStep}}. Erosion is compressed ×{{probe.erosionSpeedup}}: each model year erodes as much as that many years of the uncompressed law. Model years are not geological years.

<!-- claims: C7, C8 | sources: Rocks; Sel80; Aug92 -->

**Rock.** This run is cut into {{probe.rockName}}: relative erodibility {{probe.rockErodibility}}, steepest stable wall {{probe.rockCriticalWall}}. Steeper walls relax towards that slope at {{probe.wallFailureRate}}; rock falling onto the glacier is carried away. The ordering of the three rocks is sourced; the numbers are teaching choices (Rocks; Sel80; Aug92).

<!-- claims: C15 | sources: Lesson; Protocol -->

**What the notes measure.** Each margin note reads the cross-section under the front face, averaged over {{probe.sectionSpan}} of valley and rounded to {{probe.noteRounding}}, so the numbers do not jump from one grid cell to the next. The registered protocol measures single sections (Protocol). The front face opens on a section chosen for display after the runs were scanned; the lesson's claims rest on the registered under-ice section instead (Lesson). Grid {{probe.gridColumns}} by {{probe.gridRows}}, each {{probe.metresPerCell}} across. Solver: {{probe.backend}}.

<!-- claims: C5, C6, C7, C13, C14 | sources: Protocol; Results; Sve59; Har92 -->

**Run graphs.** For each run, the graphs show floor lowering, valley depth, floor width, steepest wall and the shape exponent b of the section under the front face, against model time, one point per snapshot every {{probe.snapshotInterval}}. Read floor lowering and the steepest wall for the rock comparison. Floor width is drawn but not ordered by rock in these runs. b near one is a V; b near two or more is a U (Sve59; Har92). Now: b = {{probe.shapeExponent}}; compared run b = {{probe.keptShapeExponent}}.

<!-- claims: C9 | sources: CS12; Model; Lesson -->

**Overdeepened sections.** Where the floor under the front face lies at least {{probe.overdeepenedThreshold}} below the floor somewhere further down-valley, a margin note says so: the bed there has an adverse slope, and ice and meltwater must flow uphill to leave the basin (CS12). Valley glaciers do carve such basins; their depth in this model is not calibrated (Model). In the recorded runs they appear in soft rock, in the lower trough, not at the valley head (Lesson).
