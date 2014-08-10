<div id="home">

  <h1>Repos</h1>
  <ul class="posts">
    {% for repo in site.github.public_repositories %}
      <li><b>{{ repo.name }}</b> {{ repo.description }}<br/> &raquo; <a href="{{ repo.html_url }}">{{ repo.html_url }}</a></li>
    {% endfor %}
  </ul>
</div>
