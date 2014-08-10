<div id="home">

  

  <h1>Github projects</h1>
  <ul class="posts">
    {% for repo in site.github.public_repositories %}
      {% if repo.fork %}
      {% else %}
        <li><b>{{ repo.name }}.</b> {{ repo.description }} &raquo; <a href="{{ repo.html_url }}">{{ repo.html_url }}</a><br/>Written on {{repo.language}}. Watchers: {{repo.watchers_count}}. Stars: {{repo.stargazers_count}}. </li>
      {% endif %}
    {% endfor %}
  </ul>
  
  <h1>Github forks</h1>
  <ul class="posts">
    {% for repo in site.github.public_repositories %}
      {% if repo.fork %}
        <li><b>{{ repo.name }}.</b> {{ repo.description }} &raquo; <a href="{{ repo.html_url }}">{{ repo.html_url }}</a></li>
      {% endif %}
    {% endfor %}
  </ul>

</div>
