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



// For consistency event name should be a string in-kebab-case with the following template: "on-[(optional)object]-[action]"

/**
 * @typedef { "on-repo-update-started" | "on-repo-update-progress" | "on-repo-update-completed" } RepoUpdateEvents
 */
/**
 * @typedef { "on-bible-text-loaded" | "on-bible-translation-changed" } BibleTextEvents
 */
/**
 * @typedef { "on-tab-selected" | "on-tab-added" } TabEvents
 */
/**
 * @typedef { "on-all-translations-removed" | "on-translation-removed" } ModuleAssistantEvents
 */
/**
 * @typedef { "on-locale-changed" } I18nEvents
 */



/**
 * @typedef { RepoUpdateEvents | BibleTextEvents | TabEvents | ModuleAssistantEvents | I18nEvents } EzraEvent
 */
