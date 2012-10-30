var md = require('node-markdown').Markdown
  , path = require('path'); 

app.get('/', function (req, res) {
  res.render('index.ejs', {content: app.content, docs: buildLinks('docs')});
});

app.get(/^\/docs\/(.+)$/, function (req, res) {
  var path = req.params[0]
    , info = app.docs['docs/' + path]
    , section = req.param('section')
    , contents = info.contents
    , result = contents;
  
  if(section) {
    result = '';
    getLines(contents).forEach(function (line) {
      if(result) {
        if(line[0] === '#') {
          return false;
        }
        result += line;
        result += '\n';
      } else if(line && line[0] === '#' && ~line.toLowerCase().indexOf(section.toLowerCase())) {
        result = line;
      }
    })
  }
  
  res.send(md(result));
});

app.get('/search', function (req, res) {
  var q = req.param('q');
  var results = app.index.search(q);
  
  results.forEach(function (r) {
    var previews = r.previews = [];
    
    Object.keys(r.locations).forEach(function (l) {
      var lineNum = Number(l);
      var p = {
        html: formatPreview(q, getLine(r.file, lineNum)),
        matches: r.locations[l].length || 0,
        section: getSecion(r.file, lineNum)
      };
      if(p.html) previews.push(p); 
      
    });
    
    delete r.locations;
    previews.sort(function (a, b) {
      return a.matches > b.matches ? -1 : 1
    });
    
    // merge previews by section
    r.previews = [];
    var sections = {};
    var order = 0;
    previews.forEach(function (p) {
      if(!p.section) return;
      var s = p.section;
      s = s.replace(/#+\s+/, '');
      if(p.html.indexOf(s) > -1) return;
      
      sections[s] = sections[s] || [];
      sections[s].push(p);
      sections[s].order = order++;
    });
    
    Object.keys(sections).forEach(function (s) {
      r.previews.push({
        title: s,
        matches: sections[s]
      });
    });
  });
  
  res.send(results);
});

app.get('/complete/:input', function (req, res) {
  var input = req.param('input');
  var terms = [];
  
  Object.keys(app.index.terms).forEach(function (term) {
    if(term && term.indexOf(input) === 0 && term.length > input.length) {
      terms.push({
        value: term,
        rank: app.index.terms[term]
      });
    }
  });
  
  Object.keys(app.index.sections).forEach(function (section) {
    if(section && section.indexOf(input) === 0 && section.length > input.length) {
      terms.push({
        value: section,
        rank: 20,
        url: app.index.sections[section].file + '?section=' + section
      });
    }
  });
  
  res.send(terms.sort(function (a, b) {
    return a.rank > b.rank ? -1 : 1;
  }).slice(0,4));
});

function buildLinks(dir) {
  var results = [];
  
  Object.keys(app.docs).forEach(function (p) {
    var info = app.docs[p];
    
    if(info.dir && path.dirname(info.dir) === dir) {
      var d = {
        path: info.dir,
        files: buildLinks(info.dir),
        title: formatTitle(info)
      };
      results.push(d);
    } else if(path.dirname(info.file) === dir) {
      results.push({
        path: info.file,
        title: formatTitle(info)
      });
    }
  });
  
  return results;
}

function formatTitle(info) {
  var meta = info.meta;
  var title = (meta && meta.title) || info.file || info.dir;
  title = path.basename(title);
  title = title.replace(path.extname(title), '');
  title = title.replace(/-/g, ' ');
  return title;
}

function getLine(file, line) {
  var info = app.docs[file];
  var contents = info && info.contents;
  
  if(contents) {
    return getLines(contents)[line];
  }
}

function formatPreview(query, str) {
  if(str[0] === '#') return;
  
  var words = query.split(/\s/);
  str = md(str);
  
  words.forEach(function (w) {
    var r = '(' + w + ')';
    str = str.replace(RegExp(r, 'gi'), '<strong class="kw-match">$1</strong>');
  });
  
  return str;
}

function getSecion(file, line) {
  var info = app.docs[file];
  var contents = info && info.contents;
  var lines = getLines(contents);
  var i = line;
  while(i--) {
    var line = lines[i];
    if(line && line.indexOf('#') === 0) return line;
  }
  return false;
}

function getLines(contents) {
  return contents.split(/\n/g);
}