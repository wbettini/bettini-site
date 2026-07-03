// Setup global tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "d3-tooltip");

// Fetch the data and trigger build functions
d3.json("fgcu_dashboard_data.json").then(data => {
    buildNetwork(data.network);
    buildHeatmap(data.heatmap);
    buildChoropleth(data.choropleth);
});

// ==========================================
// 1. Force-Directed Graph (LCOB Network)
// ==========================================
function buildNetwork(data) {
    const width = document.getElementById("network-graph").clientWidth;
    const height = 500;
    const svg = d3.select("#network-graph").append("svg").attr("viewBox", [0, 0, width, height]);

    // FGCU Themed Color Scale for the 3 Groups
    const color = d3.scaleOrdinal()
        .domain([1, 2, 3])
        .range(["#007A53", "#002878", "#BA9B37"]); // Green, Blue, Gold

    // Simulation Forces
    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.id).distance(60))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => d.size * 3));

    // Draw Links
    const link = svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(data.links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.weight) * 2);

    // Draw Nodes
    const node = svg.append("g")
        .selectAll("circle")
        .data(data.nodes)
        .join("circle")
        .attr("r", d => d.size * 1.5)
        .attr("fill", d => color(d.group))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .call(drag(simulation))
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1)
                   .html(`<strong>${d.id}</strong><br/>${d.name}`)
                   .style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // Node Labels
    const labels = svg.append("g")
        .selectAll("text")
        .data(data.nodes)
        .join("text")
        .attr("class", "node-label")
        .attr("dy", d => d.size * 1.5 + 12)
        .text(d => d.id);

    // Tick update
    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        node.attr("cx", d => d.x)
            .attr("cy", d => d.y);
        labels.attr("x", d => d.x)
              .attr("y", d => d.y);
    });

    // Drag physics
    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }
}

// ==========================================
// 2. Heatmap (Parking Garages)
// ==========================================
function buildHeatmap(data) {
    const margin = {top: 20, right: 20, bottom: 30, left: 60},
          width = document.getElementById("heatmap-graph").clientWidth - margin.left - margin.right,
          height = 350 - margin.top - margin.bottom;

    const svg = d3.select("#heatmap-graph")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const days = Array.from(new Set(data.map(d => d.day)));
    const garages = Array.from(new Set(data.map(d => d.garage)));

    const x = d3.scaleBand().range([0, width]).domain(days).padding(0.05);
    const y = d3.scaleBand().range([height, 0]).domain(garages).padding(0.05);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y));

    const colorScale = d3.scaleSequential()
        .interpolator(d3.interpolateYlOrRd)
        .domain([0, 100]); // 0 to 100% full

    svg.selectAll()
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d.day))
        .attr("y", d => y(d.garage))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", d => colorScale(d.occupancy_pct))
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1)
                   .html(`${d.garage}<br/>${d.day} at ${d.time}<br/>Capacity: ${d.occupancy_pct}%`)
                   .style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
}

// ==========================================
// 3. Choropleth Map (Florida Density)
// ==========================================
function buildChoropleth(studentData) {
    const width = document.getElementById("map-graph").clientWidth;
    const height = 350;
    const svg = d3.select("#map-graph").append("svg").attr("viewBox", [0, 0, width, height]);

    // Fetch TopoJSON for US Counties
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json").then(us => {
        // Filter specifically for Florida (FIPS prefix '12')
        const floridaCounties = topojson.feature(us, us.objects.counties).features.filter(d => d.id.startsWith("12"));

        const projection = d3.geoMercator().fitSize([width, height], {type: "FeatureCollection", features: floridaCounties});
        const path = d3.geoPath().projection(projection);

        // Setup Color Scale mapping to student data
        const maxStudents = d3.max(studentData, d => d.students);
        const colorScale = d3.scaleSequential(d3.interpolateGreens).domain([0, maxStudents]);

        // Map FIPS to Student count for easy lookup
        const dataMap = new Map(studentData.map(d => [d.fips, d]));

        svg.append("g")
            .selectAll("path")
            .data(floridaCounties)
            .join("path")
            .attr("fill", d => {
                const countyInfo = dataMap.get(d.id);
                return countyInfo ? colorScale(countyInfo.students) : "#eee";
            })
            .attr("d", path)
            .attr("stroke", "#ccc")
            .on("mouseover", (event, d) => {
                const countyInfo = dataMap.get(d.id);
                const count = countyInfo ? countyInfo.students : 0;
                tooltip.style("opacity", 1)
                       .html(`<strong>${d.properties.name} County</strong><br/>Alumni: ${count}`)
                       .style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => tooltip.style("opacity", 0));
    });
}