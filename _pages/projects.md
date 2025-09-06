---
layout: default
title: Projects
permalink: /projects/
---
# Projects

Bill actively contributes to open-source initiatives that reflect his expertise in data architecture, automation, and agentic AI strategy. These projects showcase scalable design, transparent documentation, and a forward-looking approach to intelligent systems.

## 💡 Featured Projects

{% for project in site.data.meta.projects %}
<div class="project-card">
  <h2><a href="{{ project.url }}" target="_blank">{{ project.name }}</a></h2>
  <p>{{ project.description }}</p>
</div>
{% endfor %}


