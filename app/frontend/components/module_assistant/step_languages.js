/* This file is part of Ezra Bible App.

   Copyright (C) 2019 - 2021 Ezra Bible App Development Team <contact@ezrabibleapp.net>

   Ezra Bible App is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 2 of the License, or
   (at your option) any later version.

   Ezra Bible App is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with Ezra Bible App. See the file LICENSE.
   If not, see <http://www.gnu.org/licenses/>. */


const { html } = require('../../helpers/ezra_helper.js');
const assistantController = require('./assistant_controller.js');
const i18nController = require('../../controllers/i18n_controller.js');
const languageMapper = require('../../../lib/language_mapper.js');
const assistantHelper = require('./assistant_helper.js');
const swordModuleHelper = require('../../helpers/sword_module_helper.js');
require('../loading_indicator.js');

const template = html`
<style>
  step-languages .intro {
    margin: 0 5em 1em;
    text-align: center;
  }
</style>
<loading-indicator></loading-indicator>
<p class="intro" i18n="module-assistant.pick-languages-from-repos"></p>   
`;

/**
 * @module StepLanguages
 * component retrieves, sorts and displays all available languages for module installation
 * @example
 * <step-languages></step-languages>
 * @category Component
 */
class StepLanguages extends HTMLElement {
  
  constructor() {
    super();
    console.log('LANGS: step constructor');
    this._initialized = false;
  }

  connectedCallback() {
    console.log('LANGS: started connectedCallback', this.isConnected);
    this.appendChild(template.content.cloneNode(true));
    assistantHelper.localize(this);
    this.querySelector('loading-indicator').show();
    this.addEventListener('itemSelected', (e) => this._handleCheckboxClick(e));
  }

  async init() {
    console.log('LANGS: init');
    
    assistantController.init('selectedLanguages', await ipcSettings.get('selectedLanguages', []));

    this._languageData = await getAvailableLanguagesFromRepos(); 
    
    this._initialized = true;
  }

  async listLanguages() {
    console.log('LANGS: listLanguages!');
    if (!this._initialized) {
      await this.init();
    }
    
    const languages = this._languageData.languages;

    for(const category in languages) {
      const languageArr = [...languages[category].values()].sort(assistantHelper.sortByText);
      
      if (languageArr.length > 0) {
        const sectionHeader = ['app-system-languages', 'bible-languages', 'most-speaking-languages', 'historical-languages'].includes(category) 
          ? i18n.t(`module-assistant.${category}`) : category === 'iso6391-languages' ? i18n.t('module-assistant.other-languages') : undefined;
        this.append(assistantHelper.listCheckboxSection(languageArr, assistantController.get('selectedLanguages'), sectionHeader));
      }
    }
    
    await this._updateLanguageCount();

    this.querySelector('loading-indicator').hide();
  }

  saveSelected() {
    ipcSettings.set('selectedLanguages', [...assistantController.get('selectedLanguages')]);
  }

  _handleCheckboxClick(event) {
    const languageCode = event.detail.code;
    const checked = event.detail.checked;

    this.querySelectorAll(`assistant-checkbox[code="${languageCode}"]`).forEach(checkbox => {
      if (checkbox !== event.target) {
        checkbox.checked = checked;
      }
    });
    
    if (checked) {
      assistantController.add('selectedLanguages', languageCode);
    } else {
      assistantController.remove('selectedLanguages', languageCode);
    }
  }

  async _updateLanguageCount() {
    const allLanguageCodes = this._languageData.allLanguageCodes;

    if (allLanguageCodes.size === 0) {
      return;
    }
    const repositories = await assistantController.get('allRepositories');

    const languageModuleCount = await ipcNsi.getAllLanguageModuleCount(repositories, 
                                                                       [...allLanguageCodes], 
                                                                       assistantController.get('moduleType'));
    console.log('LANGS: got languageModuleCount, trying to update', languageModuleCount);

    this.querySelectorAll('assistant-checkbox').forEach(checkbox => {
      checkbox.count = languageModuleCount[checkbox.code];
    });
  }
}

customElements.define('step-languages', StepLanguages);
module.exports = StepLanguages;

async function getAvailableLanguagesFromRepos() {
  console.log('LANGS: getAvailableLanguagesFromRepos');

  var appSystemLanguages = new Set([i18nController.getLocale(), i18nController.getSystemLocale(), ...(await getInstalledLanguages())]);
  var bibleLanguages = new Set(['grc', 'hbo']);
  var mostSpeakingLanguages = new Set(['en', 'zh', 'hi', 'es', 'ar', 'bn', 'fr', 'ru', 'pt', 'ur']); // source: https://en.wikipedia.org/wiki/List_of_languages_by_total_number_of_speakers
  const historicalLanguageTypes = new Set(['ancient', 'extinct', 'historical']);

  var languages = {
    'app-system-languages': new Map(),
    'bible-languages': new Map(),
    'most-speaking-languages': new Map(),
    'historical-languages': new Map(),
    'iso6391-languages': new Map(),
    'iso6392T-languages': new Map(),
    'iso6393-languages': new Map(),
    'unknown-languages': new Map(),
  };
  
  var allLanguageCodes = new Set();

  const repositories = await assistantController.get('allRepositories');
  console.log('LANGS: getAvailableLanguagesFromRepos: got repos', repositories);
  for (const currentRepo of repositories) {
    var repoLanguages = await ipcNsi.getRepoLanguages(currentRepo, assistantController.get('moduleType'));

    for (const currentLanguageCode of repoLanguages) {
      const languageInfo = languageMapper.getLanguageDetails(currentLanguageCode, i18nController.getLocale());

      if (appSystemLanguages.has(languageInfo.languageCode)) {
        addLanguage(languages['app-system-languages'], languageInfo, currentLanguageCode);
      } 
      
      if (bibleLanguages.has(languageInfo.languageCode)) {
        addLanguage(languages['bible-languages'], languageInfo, currentLanguageCode);
      } else if (mostSpeakingLanguages.has(languageInfo.languageCode)) {
        addLanguage(languages['most-speaking-languages'], languageInfo, currentLanguageCode);
      } else if (historicalLanguageTypes.has(languageInfo.type)) {
        addLanguage(languages['historical-languages'], languageInfo, currentLanguageCode);
      } else if (languageInfo.iso6391) {
        addLanguage(languages['iso6391-languages'], languageInfo, currentLanguageCode);
      } else if (languageInfo.iso6392T) {
        addLanguage(languages['iso6392T-languages'], languageInfo, currentLanguageCode);
      } else if (languageInfo.iso6393) {
        addLanguage(languages['iso6393-languages'], languageInfo, currentLanguageCode);
      } else {
        console.log("Unknown lang:", currentLanguageCode, languageInfo);
        addLanguage(languages['unknown-languages'], languageInfo, currentLanguageCode);          
      }

      allLanguageCodes.add(currentLanguageCode); 
    }
  }

  return {
    languages,
    allLanguageCodes
  };
}

function addLanguage(languageMap, info, fullLanguageCode) {
  var descriptionArr = [];
  if (info.languageRegion) {
    descriptionArr.push(info.languageRegion);
  }
  if (info.languageScript) {
    descriptionArr.push(info.languageScript);
  }
  languageMap.set(fullLanguageCode,
                  {code: fullLanguageCode,
                   text: info.languageName,
                   description: descriptionArr.join(' – ') });
}

async function getInstalledLanguages() {
  const installedModules = assistantController.get('installedModules');
  return Promise.all(installedModules.map(async moduleId => await swordModuleHelper.getModuleLanguage(moduleId)));
}