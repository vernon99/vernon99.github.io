<div id="home">

  <h1>Repos</h1>
  <ul class="posts">
    {% for repo in site.github.public_repositories %}
      <li><span>{{ repo.name }}</span>. {{ repo.description }} &raquo; <a href="{{ repo.html_url }}">{{ repo.html_url }}</a></li>
    {% endfor %}
  </ul>
</div>
