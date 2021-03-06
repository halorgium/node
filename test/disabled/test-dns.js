require("../common");

var dns = require("dns"),
    sys = require("sys");


// Try resolution without callback

assert.throws(function () {
  dns.resolve('google.com', 'A');
});
assert.throws(function () {
  dns.resolve('127.0.0.1', 'PTR');
});


var hosts = ['example.com', 'example.org',
             'ietf.org', // AAAA
             'google.com', // MX, multiple A records
             '_xmpp-client._tcp.google.com', // SRV
             'oakalynhall.co.uk']; // Multiple PTR replies

var records = ['A', 'AAAA', 'MX', 'TXT', 'SRV'];

var i = hosts.length;
while (i--) {

  var j = records.length;
  while (j--) {
    var hostCmd = "dig -t " + records[j] + " " + hosts[i] +
                  "| grep '^" + hosts[i] + "\\.\\W.*IN.*" + records[j] + "'" +
                  "| sed -E 's/[[:space:]]+/ /g' | cut -d ' ' -f 5- " +
                  "| sed -e 's/\\.$//'";

    sys.exec(hostCmd, checkDnsRecord(hosts[i], records[j]));
  }
}

function checkDnsRecord(host, record) {
  var myHost = host,
      myRecord = record;
  return function(err, stdout) {
    var expected = [];
    if(stdout.length)
      expected = stdout.substr(0, stdout.length - 1).split("\n");

    switch (myRecord) {
      case "A":
      case "AAAA":
        dns.resolve(myHost, myRecord, function (error, result, ttl, cname) {
            if(error) result = [];

            cmpResults(expected, result, ttl, cname);

            // do reverse lookup check
            var ll = result.length;
            while (ll--) {
              var ip = result[ll];

              var reverseCmd = "host " + ip +
                               "| cut -d \" \" -f 5-" + 
                               "| sed -e 's/\\.$//'";

              sys.exec(reverseCmd, checkReverse(ip));
            }
          }); 
        break;
      case "MX":
        dns.resolve(myHost, myRecord, function (error, result, ttl, cname) {
            if(error) result = [];

            var strResult = [];
            var ll = result.length;
            while (ll--) {
              strResult.push(result[ll].priority + " " + result[ll].exchange);
            }

            cmpResults(expected, strResult, ttl, cname);
        });
        break;
      case "TXT":
        dns.resolve(myHost, myRecord, function (error, result, ttl, cname) {
            if(error) result = [];

            var strResult = [];
            var ll = result.length;
            while (ll--) {
              strResult.push('"' + result[ll] + '"');
            }
            cmpResults(expected, strResult, ttl, cname);
        });
        break;
      case "SRV":
        dns.resolve(myHost, myRecord, function (error, result, ttl, cname) {
            if(error) result = [];

            var strResult = [];
            var ll = result.length;
            while (ll--) {
              strResult.push(result[ll].priority + " " +
                             result[ll].weight + " " +
                             result[ll].port + " " +
                             result[ll].name);
            }
            cmpResults(expected, strResult, ttl, cname);
        });
        break;
    }
  }
}

function checkReverse(ip) {
  var myIp = ip;

  return function (errr, stdout) {
    var expected = stdout.substr(0, stdout.length - 1).split("\n");

    reversing = dns.reverse(myIp, function (error, domains, ttl, cname) {
      if(error) domains = [];
      cmpResults(expected, domains, ttl, cname);
    });
  }
}

function cmpResults(expected, result, ttl, cname) {
  assert.equal(expected.length, result.length);

  expected.sort();
  result.sort();

  ll = expected.length;
  while (ll--) {
    assert.equal(result[ll], expected[ll]);
    puts("Result " + result[ll] + " was equal to expected " + expected[ll]);
  }
}
