<div id="home">

  

  <h1>Github projects</h1>
  <ul class="repos">
    {% for repo in site.github.public_repositories %}
      {% if repo.fork %}
      {% else %}
        <li>
        <span>{{ repo.created_at | date_to_string }}</span> &raquo;
        <b>{{ repo.name }}.</b> {{ repo.description }}. <a href="{{ repo.html_url }}">{{ repo.html_url }}</a><br/>
        Written on
        {% for k, v in repo.languages_url %}
    		{{ k }};
		{% endfor %}
        Watchers: <b>{{repo.watchers_count}}</b>. </li>
      {% endif %}
    {% endfor %}
  </ul>
  
  <h1>Github forks</h1>
  <ul class="repos">
    {% for repo in site.github.public_repositories %}
      {% if repo.fork %}
        <li><b>{{ repo.name }}.</b> {{ repo.description }} &raquo; <a href="{{ repo.html_url }}">{{ repo.html_url }}</a></li>
      {% endif %}
    {% endfor %}
  </ul>

</div>
