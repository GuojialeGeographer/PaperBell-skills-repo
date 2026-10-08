title: "<%= it.title %>"

cate: 论文

concepts: [<%= it.tags.map(t => '"' + t.name + '"').join(', ') %>]

important: <%= isImportant ? 'True' : 'False' %>
