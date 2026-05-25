// ── Shared constants (outside function to avoid recreation) ───────────────────
var SCHEMA_REQUIRED_FIELDS = {
  'Article': ['headline', 'author', 'datePublished'],
  'NewsArticle': ['headline', 'author', 'datePublished', 'image'],
  'BlogPosting': ['headline', 'author', 'datePublished'],
  'TechArticle': ['headline', 'author', 'datePublished'],
  'ScholarlyArticle': ['headline', 'author', 'datePublished'],
  'Report': ['headline', 'author', 'datePublished'],
  'Product': ['name', 'offers'],
  'BreadcrumbList': ['itemListElement'],
  'FAQPage': ['mainEntity'],
  'LocalBusiness': ['name', 'address'],
  'Organization': ['name'],
  'Event': ['name', 'startDate', 'location'],
  'VideoObject': ['name', 'description', 'thumbnailUrl', 'uploadDate', 'contentUrl'],
  'Recipe': ['name', 'recipeIngredient', 'recipeInstructions'],
  'HowTo': ['name', 'step'],
  'Course': ['name', 'description', 'provider'],
  'JobPosting': ['title', 'description', 'datePosted', 'jobLocation'],
  'Book': ['name', 'author'],
  'Movie': ['name', 'actor', 'director'],
  'Review': ['itemReviewed', 'reviewRating'],
  'AggregateRating': ['ratingValue', 'reviewCount'],
  'Place': ['name', 'geo'],
  'SoftwareApplication': ['name', 'operatingSystem', 'applicationCategory'],
  'Dataset': ['name', 'description', 'license'],
  'DataCatalog': ['name', 'description'],
  'Question': ['name', 'acceptedAnswer'],
  'Person': ['name'],
  'Restaurant': ['name', 'servesCuisine'],
  'Hotel': ['name', 'address'],
  'PodcastEpisode': ['name', 'description', 'transcript'],
  'PodcastSeason': ['name', 'episode'],
  'PodcastSeries': ['name', 'numberOfEpisodes'],
  'MedicalCondition': ['name', 'medicalSpecialty'],
  'MedicalWebPage': ['name', 'medicalAudience'],
  'ItemList': ['itemListElement'],
  'QAPage': ['mainEntity'],
  'Service': ['name', 'provider'],
  'WebSite': ['name', 'url'],
  'WebPage': ['name'],
  'Brand': ['name'],
  'Corporation': ['name'],
  'NGO': ['name'],
  'GovernmentOrganization': ['name'],
  'EducationalOrganization': ['name'],
  'SportsOrganization': ['name'],
  'MusicGroup': ['name'],
  'PerformingGroup': ['name'],
  'DramaSeries': ['name', 'numberOfSeasons'],
  'TVSeries': ['name', 'numberOfSeasons'],
  'Episode': ['name', 'partOfSeason'],
  'Clip': ['name', 'partOfEpisode'],
  'TVSeason': ['name', 'numberOfEpisodes'],
  'MusicRecording': ['name', 'byArtist', 'album'],
  'MusicAlbum': ['name', 'byArtist', 'numberOfTracks'],
  'MusicPlaylist': ['name', 'numberOfTracks'],
  'AudioObject': ['name', 'contentUrl'],
  'ImageObject': ['name', 'contentUrl'],
  'Drawing': ['name', 'author'],
  'Painting': ['name', 'author'],
  'Photograph': ['name', 'credit'],
  'Map': ['name', 'mapType'],
  'SatelliteImageCatalog': ['name', 'spatial'],
  'BookSeries': ['name', 'hasPart'],
  'ComicSeries': ['name', 'numberOfIssues'],
  'ComicIssue': ['name', 'partOfSeries'],
  'VideoGame': ['name', 'playMode', 'applicationCategory'],
  'VideoGameSeries': ['name', 'numberOfGames'],
  'VideoGameClip': ['name', 'partOfVideoGame'],
  'ExerciseGym': ['name', 'address'],
  'HealthClub': ['name', 'address'],
  'SportsActivityLocation': ['name', 'address'],
  'Aquarium': ['name', 'address'],
  'ArtGallery': ['name', 'address'],
  'Beach': ['name', 'geo'],
  'BowlingAlley': ['name', 'address'],
  'BusStation': ['name', 'address'],
  'Cafe': ['name', 'servesCuisine'],
  'Campground': ['name', 'geo'],
  'ChargingStation': ['name', 'address'],
  'ChildCare': ['name', 'address'],
  'Dentist': ['name', 'address'],
  'DryCleaningOrLaundry': ['name', 'address'],
  'Embassy': ['name', 'address'],
  'FireStation': ['name', 'address'],
  'Foundation': ['name'],
  'FurnitureStore': ['name', 'address'],
  'GamblingEstablishment': ['name', 'address'],
  'HinduTemple': ['name', 'address'],
  'HomeAndConstructionBusiness': ['name', 'address'],
  'InsuranceAgency': ['name', 'address'],
  'JewelryStore': ['name', 'address'],
  'LegalService': ['name', 'address'],
  'Library': ['name', 'address'],
  'LiquorStore': ['name', 'address'],
  'Locksmith': ['name', 'address'],
  'Mosque': ['name', 'address'],
  'MovieRentalStore': ['name', 'address'],
  'MovieTheater': ['name', 'address'],
  'MovingCompany': ['name', 'address'],
  'MusicStore': ['name', 'address'],
  'NightClub': ['name', 'address'],
  'Notary': ['name', 'address'],
  'ParkingFacility': ['name', 'geo'],
  'PetStore': ['name', 'address'],
  'Pharmacy': ['name', 'address'],
  'Plumber': ['name', 'address'],
  'PoliceStation': ['name', 'address'],
  'PostOffice': ['name', 'address'],
  'RealEstateAgent': ['name', 'address'],
  'RVPark': ['name', 'geo'],
  'RoofingContractor': ['name', 'address'],
  'RoomingHouse': ['name', 'address'],
  'StorageRepository': ['name', 'address'],
  'SubwayStation': ['name', 'address'],
  'Synagogue': ['name', 'address'],
  'TaxiService': ['name', 'address'],
  'TireShop': ['name', 'address'],
  'TouristInformationCenter': ['name', 'address'],
  'TrainStation': ['name', 'address'],
  'TransitStation': ['name', 'address'],
  'TravelAgency': ['name', 'address'],
  'VeterinaryCare': ['name', 'address'],
  'WholesaleStore': ['name', 'address'],
  'Winery': ['name', 'address'],
  'AutoDealer': ['name', 'address'],
  'AutoPartsStore': ['name', 'address'],
  'AutoRepair': ['name', 'address'],
  'AutoRental': ['name', 'address'],
  'AutoWash': ['name', 'address'],
  'BikeStore': ['name', 'address'],
  'Bootery': ['name', 'address'],
  'BookStore': ['name', 'address'],
  'ClothingStore': ['name', 'address'],
  'ComputerStore': ['name', 'address'],
  'ConvenienceStore': ['name', 'address'],
  'DepartmentStore': ['name', 'address'],
  'ElectronicsStore': ['name', 'address'],
  'Florist': ['name', 'address'],
  'HardwareStore': ['name', 'address'],
  'HomeGoodsStore': ['name', 'address'],
  'InputDevice': ['name', 'manufacturer'],
  'Peripheral': ['name', 'manufacturer'],
  'Monitor': ['name', 'manufacturer'],
  'Computer': ['name', 'manufacturer'],
  'Server': ['name', 'manufacturer'],
  'TabletComputer': ['name', 'manufacturer'],
  'WearableDevice': ['name', 'manufacturer'],
  'MobilePhone': ['name', 'manufacturer'],
  'SoftwareSourceCode': ['name', 'codeRepository'],
  'APIReference': ['name', 'apiDocumentation'],
  'SourceCode': ['name', 'programmingLanguage'],
  'ComputerLanguage': ['name', 'programmingLanguageVersion'],
  'ProgrammingLanguage': ['name', 'version'],
  'MobileApplication': ['name', 'operatingSystem'],
  'GameServer': ['name', 'game'],
  'OSRelease': ['name', 'operatingSystem'],
  'WebApplication': ['name', 'browserRequirements'],
  'ChromeExtension': ['name', 'extension'],
  'FirefoxExtension': ['name', 'extension'],
  'SafariExtension': ['name', 'extension'],
  'OperaExtension': ['name', 'extension'],
  'EducationalOccupationalCredential': ['name', 'credentialCategory'],
  'EducationalOccupationalProgram': ['name', 'educationalProgramType'],
  'Grant': ['name', 'fundingType'],
  'ScholarlyField': ['name'],
  'DefinedTerm': ['name', 'termCode'],
  'DefinedRegion': ['name', 'endpoints'],
  'PlaceOfWorship': ['name', 'address'],
  'Cemetery': ['name', 'geo'],
  'Landform': ['name', 'elevation'],
  'Mountain': ['name', 'elevation'],
  'Valley': ['name', 'elevation'],
  'BodyOfWater': ['name', 'geo'],
  'Spring': ['name', 'geo'],
  'Waterfall': ['name', 'geo'],
  'Island': ['name', 'geo'],
  'Continent': ['name'],
  'Country': ['name'],
  'State': ['name'],
  'AdministrativeArea': ['name'],
  'City': ['name'],
  'Population': ['name'],
  'GeoShape': ['name', 'box'],
  'GeoCircle': ['name', 'geoMid'],
  'GeoCoordinates': ['latitude', 'longitude'],
  'LandmarksOrHistoricalBuildings': ['name', 'address'],
  'TouristDestination': ['name', 'geo'],
  'TouristAttraction': ['name', 'address'],
  'ThemePark': ['name', 'address'],
  'Zoo': ['name', 'address'],
  'AmusementPark': ['name', 'address'],
  'Archive': ['name', 'address']
};

var SCHEMA_VALID_CONTEXTS = [
  'https://schema.org',
  'http://schema.org',
  'https://schema.org/docs',
  'https://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'https://www.googleapis.com',
  'https://search.google.com'
];

var SCHEMA_TYPE_GROUPS = {
  content: ['Article', 'NewsArticle', 'BlogPosting', 'ScholarlyArticle', 'TechArticle', 'Report'],
  product: ['Product', 'Service'],
  business: ['LocalBusiness', 'Organization', 'Corporation', 'NGO'],
  page: ['FAQPage', 'CollectionPage', 'ItemPage', 'QAPage'],
};

function runSchemaChecker(p) {
  var issues = [];

  var ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
  var microdataItems = document.querySelectorAll('[itemscope]');

  var richResultsUrl = 'https://search.google.com/test/rich-results?url=' + encodeURIComponent(window.location.href);
  issues.push({
    type: 'rich_results_test_link',
    message: 'Перевірте розмітку в Google Rich Results Test',
    severity: 'info',
    url: richResultsUrl,
    urlLabel: 'Відкрити Google Rich Results Test →'
  });

  if (ldJsonScripts.length === 0 && microdataItems.length === 0) {
    issues.push({ type: 'no_structured_data', message: 'No structured data found on the page (JSON-LD or microdata)', severity: 'notice' });
    return { id: 'schema', name: 'Schema', issues: issues };
  }

  // Collect all parsed schemas for conflict detection & overview
  var allSchemas = [];
  var schemaJsonHashes = {}; // for duplicate detection

  // ── JSON-LD parsing ─────────────────────────────────────────────────────────
  Array.prototype.slice.call(ldJsonScripts).forEach(function(script, index) {
    var rawText = (script.textContent || '').trim();
    if (!rawText) return;

    // Duplicate detection
    var hash = simpleHash(rawText);
    if (schemaJsonHashes[hash]) {
      issues.push({
        type: 'duplicate_json_ld',
        message: 'Duplicate JSON-LD block #' + (index + 1) + ' (identical to block #' + schemaJsonHashes[hash] + ')',
        severity: 'notice',
        detail: 'Duplicate blocks waste resources and may confuse crawlers.'
      });
      return;
    }
    schemaJsonHashes[hash] = index + 1;

    var data;
    try {
      data = JSON.parse(rawText);
    } catch(e) {
      issues.push({
        type: 'invalid_json',
        message: 'JSON-LD block #' + (index + 1) + ' contains invalid JSON',
        severity: 'warning',
        detail: e.message,
        highlight: true
      });
      return;
    }

    // Handle arrays of schemas
    var topLevel = Array.isArray(data) ? data : [data];

    topLevel.forEach(function(schema, schemaIdx) {
      var label = 'JSON-LD block #' + (index + 1) + (topLevel.length > 1 ? ' item ' + (schemaIdx + 1) : '');

      // Validate @context
      if (!schema['@context']) {
        issues.push({ type: 'missing_context', message: label + ': missing @context', severity: 'warning' });
      } else {
        var ctx = schema['@context'];
        var ctxStr = typeof ctx === 'string' ? ctx : (Array.isArray(ctx) ? ctx.join('') : JSON.stringify(ctx));
        var ctxValid = SCHEMA_VALID_CONTEXTS.some(function(vc) { return ctxStr.indexOf(vc) !== -1; });
        if (!ctxValid) {
          issues.push({ type: 'invalid_context', message: label + ': unknown @context', severity: 'notice', detail: 'Expected https://schema.org or derived URL. Current: ' + ctxStr.substring(0, 100) });
        }
      }

      // @graph pattern
      var items = null;
      var isGraph = false;
      if (Array.isArray(schema['@graph'])) {
        items = schema['@graph'];
        isGraph = true;
        if (items.length === 0) {
          issues.push({
            type: 'empty_graph',
            message: label + ': empty @graph array',
            severity: 'notice',
            detail: '@graph contains no items. This provides no structured data.'
          });
        }
      }

      if (!isGraph) {
        // Single schema object (not a graph wrapper)
        items = [schema];
      }

      items.forEach(function(item) {
        var itemLabel = isGraph ? label + ' [@graph item]' : label;
        var schemaType = item['@type'];
        var typeDisplay = schemaType
          ? (Array.isArray(schemaType) ? schemaType.join(', ') : schemaType)
          : '(type not specified)';

        // Info: schema found
        var jsonStr = JSON.stringify(item, null, 2);
        issues.push({
          type: 'schema_found',
          message: 'Schema: ' + typeDisplay,
          severity: 'info',
          detail: jsonStr.length > 800 ? jsonStr.substring(0, 800) + '\n…truncated' : jsonStr
        });

        if (!schemaType) {
          issues.push({ type: 'missing_type', message: itemLabel + ': missing @type', severity: 'warning' });
          return;
        }

        // Normalize type to string
        var typeStr = Array.isArray(schemaType) ? schemaType[0] : schemaType;

        // Collect for conflict detection
        allSchemas.push({ type: typeStr, label: itemLabel, item: item });

        // ── Required fields check ─────────────────────────────────────────────
        var required = SCHEMA_REQUIRED_FIELDS[typeStr];
        if (required) {
          required.forEach(function(field) {
            if (!item[field]) {
              issues.push({
                type: 'missing_required_field',
                message: typeStr + ': missing required field "' + field + '"',
                severity: 'notice',
                detail: itemLabel
              });
            }
          });
        }

        // ── URL vs current page ───────────────────────────────────────────────
        if (item.url) {
          try {
            var schemaUrl = new URL(item.url, window.location.href).href;
            var currentPage = window.location.href.split('#')[0];
            if (schemaUrl !== currentPage && schemaUrl.indexOf(currentPage) !== 0) {
              issues.push({
                type: 'schema_url_mismatch',
                message: typeStr + ': URL does not match current page',
                severity: 'notice',
                detail: 'Schema URL: ' + item.url + '\nCurrent: ' + currentPage
              });
            }
          } catch(e) {}
        }

        // ── mainEntityOfPage ──────────────────────────────────────────────────
        if (item.mainEntityOfPage) {
          var MEP = item.mainEntityOfPage;
          if (typeof MEP === 'string') {
            try {
              var mepUrl = new URL(MEP, window.location.href).href;
              if (mepUrl !== window.location.href.split('#')[0]) {
                issues.push({
                  type: 'schema_mainentity_mismatch',
                  message: typeStr + ': mainEntityOfPage does not point to current page',
                  severity: 'notice',
                  detail: 'mainEntityOfPage: ' + MEP + '\nCurrent: ' + window.location.href.split('#')[0]
                });
              }
            } catch(e) {}
          } else if (MEP && MEP['@id']) {
            try {
              var mepId = new URL(MEP['@id'], window.location.href).href;
              if (mepId !== window.location.href.split('#')[0]) {
                issues.push({
                  type: 'schema_mainentity_mismatch',
                  message: typeStr + ': mainEntityOfPage @id does not point to current page',
                  severity: 'notice',
                  detail: 'mainEntityOfPage: ' + MEP['@id']
                });
              }
            } catch(e) {}
          }
        }

        // ── BreadcrumbList validation ─────────────────────────────────────────
        if (typeStr === 'BreadcrumbList' && item.itemListElement) {
          var bcItems = Array.isArray(item.itemListElement) ? item.itemListElement : [item.itemListElement];
          var positions = [];
          bcItems.forEach(function(bc, bi) {
            var bcLabel = itemLabel + ' [breadcrumb ' + (bi + 1) + ']';
            if (bc.position === undefined || bc.position === null || bc.position === '') {
              issues.push({ type: 'breadcrumb_missing_position', message: 'BreadcrumbList: item without position', severity: 'notice', detail: bcLabel });
            } else {
              positions.push(parseInt(bc.position, 10));
            }
            if (!bc.name) {
              issues.push({ type: 'breadcrumb_missing_name', message: 'BreadcrumbList: item without name', severity: 'notice', detail: bcLabel });
            }
            if (bi < bcItems.length - 1 && !bc.item && !bc['@id']) {
              issues.push({ type: 'breadcrumb_missing_item', message: 'BreadcrumbList: non-last item without item URL', severity: 'notice', detail: bcLabel });
            }
          });
          if (positions.length > 0 && positions[0] !== 1) {
            issues.push({ type: 'breadcrumb_first_position', message: 'BreadcrumbList: first position should be 1, got ' + positions[0], severity: 'notice' });
          }
          for (var pi = 1; pi < positions.length; pi++) {
            if (positions[pi] !== positions[pi - 1] + 1) {
              issues.push({ type: 'breadcrumb_nonsequential', message: 'BreadcrumbList: positions not sequential (' + positions.join(', ') + ')', severity: 'notice', detail: 'Google requires: 1, 2, 3…' });
              break;
            }
          }
        }

        // ── FAQPage validation ────────────────────────────────────────────────
        if (typeStr === 'FAQPage' && item.mainEntity) {
          var faqItems = Array.isArray(item.mainEntity) ? item.mainEntity : [item.mainEntity];
          faqItems.forEach(function(q, qi) {
            var qLabel = itemLabel + ' [question ' + (qi + 1) + ']';
            if (q['@type'] !== 'Question') {
              issues.push({
                type: 'faq_invalid_question_type',
                message: 'FAQPage: mainEntity item is not type Question',
                severity: 'warning',
                detail: qLabel + ' — @type: ' + (q['@type'] || 'not set')
              });
            }
            if (!q.name) {
              issues.push({ type: 'faq_missing_question', message: 'FAQPage: Question missing "name" field', severity: 'notice', detail: qLabel });
            }
            var answer = q.acceptedAnswer;
            if (!answer) {
              issues.push({ type: 'faq_missing_answer', message: 'FAQPage: Question missing "acceptedAnswer"', severity: 'notice', detail: qLabel });
            } else if (answer['@type'] !== 'Answer') {
              issues.push({
                type: 'faq_invalid_answer_type',
                message: 'FAQPage: acceptedAnswer is not type "Answer"',
                severity: 'notice',
                detail: qLabel + ' — @type: ' + (answer['@type'] || 'not set')
              });
            } else if (!answer.text) {
              issues.push({ type: 'faq_missing_answer_text', message: 'FAQPage: Answer missing "text" field', severity: 'notice', detail: qLabel });
            }
          });
          if (faqItems.length < 1) {
            issues.push({ type: 'faq_empty', message: 'FAQPage: mainEntity is empty', severity: 'warning', detail: itemLabel });
          }
        }

        // ── QAPage validation ─────────────────────────────────────────────────
        if (typeStr === 'QAPage' && item.mainEntity) {
          var qaMain = item.mainEntity;
          if (qaMain['@type'] !== 'Question') {
            issues.push({
              type: 'qapage_invalid_question',
              message: 'QAPage: mainEntity is not type Question',
              severity: 'notice',
              detail: itemLabel + ' — @type: ' + (qaMain['@type'] || 'not set')
            });
          }
        }

        // ── HowTo validation ──────────────────────────────────────────────────
        if (typeStr === 'HowTo' && item.step) {
          var steps = Array.isArray(item.step) ? item.step : [item.step];
          steps.forEach(function(step, si) {
            var stepLabel = itemLabel + ' [step ' + (si + 1) + ']';
            if (step['@type'] !== 'HowToStep') {
              issues.push({
                type: 'howto_invalid_step_type',
                message: 'HowTo: step is not type HowToStep',
                severity: 'notice',
                detail: stepLabel + ' — @type: ' + (step['@type'] || 'not set')
              });
            }
            if (!step.name && !step.text) {
              issues.push({ type: 'howto_missing_step_name', message: 'HowTo: step missing name/text', severity: 'notice', detail: stepLabel });
            }
            if (!step.url && !step['@id']) {
              issues.push({ type: 'howto_missing_step_url', message: 'HowTo: step missing url/@id', severity: 'notice', detail: stepLabel });
            }
          });
          if (!item.totalTime) {
            issues.push({
              type: 'howto_missing_totaltime',
              message: 'HowTo: missing totalTime (recommended)',
              severity: 'notice',
              detail: itemLabel + ' — Format: ISO 8601 duration, e.g. PT30M'
            });
          }
          if (!item.supplies && !item.tool) {
            issues.push({
              type: 'howto_missing_supplies',
              message: 'HowTo: missing supplies/tool (recommended)',
              severity: 'notice',
              detail: itemLabel
            });
          }
        }

        // ── VideoObject validation ────────────────────────────────────────────
        if (typeStr === 'VideoObject') {
          if (!item.contentUrl && !item.embedUrl && !item.thumbnailUrl) {
            issues.push({
              type: 'video_missing_url',
              message: 'VideoObject: missing contentUrl, embedUrl, and thumbnailUrl',
              severity: 'warning',
              detail: itemLabel + '\nAt least one URL is required for video rich results.'
            });
          }
          if (!item.duration) {
            issues.push({
              type: 'video_missing_duration',
              message: 'VideoObject: missing duration',
              severity: 'notice',
              detail: itemLabel + '\nFormat: ISO 8601 (e.g., PT1H30M)'
            });
          } else if (!/^P(?:\d+(?:\.\d+)?Y)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?W)?(?:\d+(?:\.\d+)?D)?(?:T(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?)?$/.test(item.duration)) {
            issues.push({
              type: 'video_invalid_duration',
              message: 'VideoObject: duration not ISO 8601: "' + item.duration + '"',
              severity: 'notice',
              detail: itemLabel + '\nExpected: PT1H30M, PT90S, etc.'
            });
          }
        }

        // ── Recipe validation ─────────────────────────────────────────────────
        if (typeStr === 'Recipe') {
          if (!item.recipeCategory) {
            issues.push({ type: 'recipe_missing_category', message: 'Recipe: missing recipeCategory (recommended)', severity: 'notice', detail: itemLabel });
          }
          if (!item.recipeYield) {
            issues.push({ type: 'recipe_missing_yield', message: 'Recipe: missing recipeYield (recommended)', severity: 'notice', detail: itemLabel });
          }
          if (!item.cookTime && !item.totalTime && !item.prepTime) {
            issues.push({
              type: 'recipe_missing_time',
              message: 'Recipe: missing cookTime/totalTime/prepTime',
              severity: 'notice',
              detail: itemLabel + '\nFormat: ISO 8601 duration (e.g., PT30M)'
            });
          }
          if (item.recipeIngredient) {
            var ingredients = Array.isArray(item.recipeIngredient) ? item.recipeIngredient : [item.recipeIngredient];
            if (ingredients.length === 0) {
              issues.push({ type: 'recipe_empty_ingredients', message: 'Recipe: recipeIngredient array is empty', severity: 'notice', detail: itemLabel });
            }
          }
        }

        // ── JobPosting validation ─────────────────────────────────────────────
        if (typeStr === 'JobPosting') {
          if (!item.jobLocation) {
            issues.push({ type: 'jobposting_missing_location', message: 'JobPosting: missing jobLocation', severity: 'warning', detail: itemLabel });
          } else if (item.jobLocation && !item.jobLocation.address) {
            issues.push({
              type: 'jobposting_missing_location_address',
              message: 'JobPosting: jobLocation missing address',
              severity: 'notice',
              detail: itemLabel
            });
          }
          if (!item.employmentType) {
            issues.push({
              type: 'jobposting_missing_employmenttype',
              message: 'JobPosting: missing employmentType (recommended)',
              severity: 'notice',
              detail: itemLabel + '\nValues: FULL_TIME, PART_TIME, CONTRACTOR, etc.'
            });
          }
          if (item.baseSalary) {
            var salary = item.baseSalary;
            if (!salary.valueCurrency) {
              issues.push({
                type: 'jobposting_missing_currency',
                message: 'JobPosting: baseSalary missing valueCurrency',
                severity: 'notice',
                detail: itemLabel
              });
            }
          }
        }

        // ── Event validation ──────────────────────────────────────────────────
        if (typeStr === 'Event') {
          if (!item.location) {
            issues.push({
              type: 'event_missing_location',
              message: 'Event: missing location',
              severity: 'notice',
              detail: itemLabel + '\nCan be Place, VirtualLocation, or EventVenue.'
            });
          }
          if (!item.eventStatus) {
            issues.push({
              type: 'event_missing_status',
              message: 'Event: missing eventStatus (recommended)',
              severity: 'notice',
              detail: itemLabel + '\nValues: EventScheduled, EventCancelled, EventPostponed, EventMovedOnline, EventOnlineOnly.'
            });
          }
          if (item.eventAttendanceMode) {
            var validModes = ['EventAttendanceMode', 'OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode'];
            if (validModes.indexOf(item.eventAttendanceMode) === -1) {
              issues.push({
                type: 'event_invalid_attendance_mode',
                message: 'Event: invalid eventAttendanceMode: "' + item.eventAttendanceMode + '"',
                severity: 'notice',
                detail: itemLabel
              });
            }
          }
          if (item.startDate && item.endDate) {
            try {
              if (new Date(item.endDate) < new Date(item.startDate)) {
                issues.push({
                  type: 'event_end_before_start',
                  message: 'Event: endDate is before startDate',
                  severity: 'warning',
                  detail: itemLabel + '\nStart: ' + item.startDate + '\nEnd: ' + item.endDate
                });
              }
            } catch(e) {}
          }
        }

        // ── AggregateRating validation ────────────────────────────────────────
        if (typeStr === 'AggregateRating') {
          if (item.ratingValue) {
            var rv = parseFloat(item.ratingValue);
            if (isNaN(rv) || rv < 0 || rv > item.bestRating) {
              issues.push({
                type: 'aggregaterating_invalid',
                message: 'AggregateRating: ratingValue out of range',
                severity: 'warning',
                detail: itemLabel + '\nratingValue: ' + item.ratingValue + (item.bestRating ? ', bestRating: ' + item.bestRating : '')
              });
            }
          }
          if (item.reviewCount) {
            var rc = parseInt(item.reviewCount, 10);
            if (isNaN(rc) || rc < 0) {
              issues.push({
                type: 'aggregaterating_negative_reviews',
                message: 'AggregateRating: reviewCount is negative or invalid',
                severity: 'warning',
                detail: itemLabel + '\nreviewCount: ' + item.reviewCount
              });
            }
          }
          if (!item.bestRating && item.ratingValue) {
            issues.push({
              type: 'aggregaterating_missing_best',
              message: 'AggregateRating: missing bestRating (needed for context)',
              severity: 'notice',
              detail: itemLabel
            });
          }
        }

        // ── Review validation ─────────────────────────────────────────────────
        if (typeStr === 'Review') {
          if (item.reviewRating && item.reviewRating.ratingValue) {
            var reviewRv = parseFloat(item.reviewRating.ratingValue);
            if (isNaN(reviewRv) || reviewRv < 0) {
              issues.push({
                type: 'review_invalid_rating',
                message: 'Review: invalid ratingValue',
                severity: 'notice',
                detail: itemLabel + '\nratingValue: ' + item.reviewRating.ratingValue
              });
            }
          }
        }

        // ── Offer validation ──────────────────────────────────────────────────
        if (typeStr === 'Offer') {
          if (item.price && !item.priceCurrency) {
            issues.push({
              type: 'missing_price_currency',
              message: 'Offer: missing priceCurrency (price = ' + item.price + ')',
              severity: 'warning',
              detail: itemLabel
            });
          }
          if (item.price && isNaN(parseFloat(item.price))) {
            issues.push({
              type: 'invalid_price',
              message: 'Offer: invalid price value ("' + item.price + '")',
              severity: 'warning',
              detail: itemLabel
            });
          }
          if (item.price && item.priceCurrency) {
            var currency = item.priceCurrency.toUpperCase();
            if (!/^[A-Z]{3}$/.test(currency)) {
              issues.push({
                type: 'invalid_currency_code',
                message: 'Offer: invalid currency code "' + currency + '" (should be ISO 4217, e.g., USD)',
                severity: 'notice',
                detail: itemLabel
              });
            }
          }
        }

        // Also check nested offers (Product.offers)
        if (item.offers) {
          var offers = Array.isArray(item.offers) ? item.offers : [item.offers];
          offers.forEach(function(offer, oi) {
            if (offer.price && !offer.priceCurrency) {
              issues.push({
                type: 'missing_price_currency',
                message: 'Nested Offer: missing priceCurrency (price = ' + offer.price + ')',
                severity: 'warning',
                detail: itemLabel + ' (offer #' + (oi + 1) + ')'
              });
            }
            if (offer.price && isNaN(parseFloat(offer.price))) {
              issues.push({
                type: 'invalid_price',
                message: 'Nested Offer: invalid price ("' + offer.price + '")',
                severity: 'warning',
                detail: itemLabel + ' (offer #' + (oi + 1) + ')'
              });
            }
            if (offer.priceCurrency) {
              var cur = offer.priceCurrency.toUpperCase();
              if (!/^[A-Z]{3}$/.test(cur)) {
                issues.push({
                  type: 'invalid_currency_code',
                  message: 'Nested Offer: invalid currency code "' + cur + '"',
                  severity: 'notice',
                  detail: itemLabel + ' (offer #' + (oi + 1) + ')'
                });
              }
            }
            if (offer.priceSpecification && offer.priceSpecification.price && !offer.priceSpecification.priceCurrency) {
              issues.push({
                type: 'missing_price_currency',
                message: 'Nested Offer: priceSpecification missing priceCurrency',
                severity: 'warning',
                detail: itemLabel + ' (offer #' + (oi + 1) + ')'
              });
            }
          });
        }

        // ── Image field validation ────────────────────────────────────────────
        if (item.image) {
          var images = Array.isArray(item.image) ? item.image : [item.image];
          images.forEach(function(img) {
            var imgUrl = null;
            if (typeof img === 'string') {
              imgUrl = img;
            } else if (img && img['@id']) {
              imgUrl = img['@id'];
            } else if (img && img.url) {
              imgUrl = img.url;
            }
            if (imgUrl && imgUrl.indexOf('http') !== 0) {
              issues.push({
                type: 'image_not_url',
                message: typeStr + ': image is not an absolute URL',
                severity: 'notice',
                detail: itemLabel + ' — ' + imgUrl.substring(0, 80)
              });
            }
          });
        }

        // ── datePublished vs dateModified ─────────────────────────────────────
        if (item.datePublished && item.dateModified) {
          try {
            var pubDate = new Date(item.datePublished);
            var modDate = new Date(item.dateModified);
            if (!isNaN(pubDate.getTime()) && !isNaN(modDate.getTime())) {
              if (modDate < pubDate) {
                issues.push({
                  type: 'date_modified_before_published',
                  message: typeStr + ': dateModified before datePublished',
                  severity: 'warning',
                  detail: itemLabel + '\nPublished: ' + item.datePublished + '\nModified: ' + item.dateModified
                });
              }
            }
          } catch(e) {}
        }
      });
    });
  });

  // ── Microdata validation ────────────────────────────────────────────────────
  if (microdataItems.length > 0) {
    Array.prototype.forEach.call(microdataItems, function(el, mi) {
      var itemType = el.getAttribute('itemtype') || '';
      var itemLabel = 'Microdata #' + (mi + 1);

      if (!itemType) {
        issues.push({
          type: 'microdata_no_itemtype',
          message: itemLabel + ': [itemscope] without itemtype',
          severity: 'warning',
          detail: 'Each itemscope should have an itemtype attribute pointing to a Schema.org type.'
        });
        return;
      }

      var microType = itemType.split('/').pop();
      allSchemas.push({ type: microType, label: itemLabel, item: null });

      issues.push({
        type: 'microdata_found',
        message: 'Microdata: ' + microType,
        severity: 'info',
        detail: 'itemtype: ' + itemType
      });

      // Check for itemprop attributes
      var itemprops = el.querySelectorAll('[itemprop]');
      if (itemprops.length === 0) {
        issues.push({
          type: 'microdata_no_itemprop',
          message: itemLabel + ': no [itemprop] attributes found',
          severity: 'notice',
          detail: 'The itemscope has no properties defined. Add itemprop="..." to child elements.'
        });
      }
    });
  }

  // ── Overview ────────────────────────────────────────────────────────────────
  var typeCounts = {};
  allSchemas.forEach(function(s) {
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  });
  var typeSummary = Object.keys(typeCounts).map(function(t) { return t + ' ×' + typeCounts[t]; }).join(', ');

  issues.unshift({
    type: 'schema_overview',
    message: 'Structured Data — ' + allSchemas.length + ' schema' + (allSchemas.length !== 1 ? 's' : '') + ' found',
    severity: 'info',
    detail: [
      'JSON-LD blocks    ' + ldJsonScripts.length,
      'Microdata items   ' + microdataItems.length,
      'Total schemas     ' + allSchemas.length,
      'Types             ' + (typeSummary || 'none'),
    ].join('\n')
  });

  // ── Conflict detection ──────────────────────────────────────────────────────
  var foundTypes = {};
  allSchemas.forEach(function(s) { foundTypes[s.type] = true; });

  Object.keys(SCHEMA_TYPE_GROUPS).forEach(function(group) {
    var typesInGroup = SCHEMA_TYPE_GROUPS[group].filter(function(t) { return foundTypes[t]; });
    if (typesInGroup.length > 1) {
      issues.push({
        type: 'conflicting_schemas',
        message: 'Conflicting schemas in group "' + group + '": ' + typesInGroup.join(', '),
        severity: 'warning',
        detail: 'Multiple related types may confuse search engines. Use one primary type.'
      });
    }
  });

  // Multiple FAQPage
  var faqCount = allSchemas.filter(function(s) { return s.type === 'FAQPage'; }).length;
  if (faqCount > 1) {
    issues.push({
      type: 'multiple_faqpage',
      message: 'Multiple FAQPage schemas (' + faqCount + ')',
      severity: 'warning',
      detail: 'Google recommends one FAQPage per page.'
    });
  }

  // Multiple HowTo
  var howToCount = allSchemas.filter(function(s) { return s.type === 'HowTo'; }).length;
  if (howToCount > 1) {
    issues.push({
      type: 'multiple_howto',
      message: 'Multiple HowTo schemas (' + howToCount + ')',
      severity: 'notice',
      detail: 'Multiple HowTo schemas are allowed but may create SERP conflicts.'
    });
  }

  // WebPage vs Article
  if (foundTypes['WebPage'] && foundTypes['Article']) {
    issues.push({
      type: 'webpage_article_conflict',
      message: 'Combined WebPage + Article schemas',
      severity: 'notice',
      detail: 'Article is a subclass of WebPage. Ensure this is intentional.'
    });
  }

  return { id: 'schema', name: 'Schema', issues: issues };
}

// Simple hash for duplicate detection
function simpleHash(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
