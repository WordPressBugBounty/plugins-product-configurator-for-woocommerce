<?php

if (!defined('ABSPATH')) die('No direct access.');

/*
Licence: MIT / GPLv2+
*/

if (!class_exists('Updraft_Manager_Updater_1_9')):
class Updraft_Manager_Updater_1_9 {

	public $version = '1.9.5';

	public $relative_plugin_file;
	public $slug;
	public $url;
	public $debug;

	public $user_addons;
	public $available_addons;
	public $remote_addons;

	public $muid;

	public $plug_updatechecker;

	private $allow_auto_updates = true;
	public $auto_backoff =  true;
	public $interval_hours = 24;
	
	private $option_name;
	private $admin_notices = array();
	private $udmupdaterl10n;
	
	public $require_login = true;
	
	private $plugin_data = null;

	private $ourdir;

	private $plugin_file;
	
	private $connector_footer_added = false;

	/**
	 * Constructor
	 *
	 * @param String  $mothership
	 * @param Integer $muid
	 * @param String  $relative_plugin_file
	 * @param Array   $options - further options; keys: 'interval_hours' (integer), 'auto_backoff' (boolean), 'debug' (boolean), 'require_login' (boolean)
	 */
	public function __construct($mothership, $muid, $relative_plugin_file, $options = array()) {

		include(ABSPATH.WPINC.'/version.php');

		$this->auto_backoff = isset($options['auto_backoff']) ? $options['auto_backoff'] : true;
		$this->debug = isset($options['debug']) ? $options['debug'] : false;
		$this->require_login = isset($options['require_login']) ? $options['require_login'] : true;
		$this->interval_hours = isset($options['interval_hours']) ? $options['interval_hours'] : 24;
	
		$this->relative_plugin_file = $relative_plugin_file;
		$this->slug = dirname($relative_plugin_file);
		$this->url = trailingslashit($mothership).'?muid='.$muid;
		$this->muid = $muid;
		$this->ourdir = dirname(__FILE__);

		// This needs to exactly match PluginUpdateChecker's view
		$this->plugin_file = trailingslashit(WP_PLUGIN_DIR).$relative_plugin_file;

		if (!file_exists($this->plugin_file)) throw new Exception("Plugin file not found: ".$this->plugin_file);

		add_action('wp_ajax_udmupdater_ajax', array($this, 'udmupdater_ajax'));

		// Prevent updates from wordpress.org showing in all circumstances. Run with lower than default priority, to allow later processes to add something.
		add_filter('site_transient_update_plugins', array($this, 'site_transient_update_plugins'), 9);

		$this->udmupdaterl10n = array(
			'duplicate_site_id' => __('This site was previously using a licence also used by another WordPress install with a different URL (which most likely originates from one of the sites being created by duplicating the other) - this has resulted in the licence being disconnected from this site', 'udmupdater')
		);

		// Expiry notices
		add_action(is_multisite() ? 'network_admin_menu' : 'admin_menu', array($this, 'admin_menu'));

		$this->option_name = $this->slug.'_updater_options';

		if (did_action('init')) {
			$this->load_text_domain();
		} else {
			add_action('init', array($this, 'load_text_domain'));
		}
		
		$this->get_puc_updates_checker();

		add_action("after_plugin_row_$relative_plugin_file", array($this, 'after_plugin_row'), 10, 2 );
		add_action('load-plugins.php', array($this, 'load_plugins_php'));
		add_action('core_upgrade_preamble', array($this, 'core_upgrade_preamble'));
		
		/**
		 * Maintain compatibility on all versions between WordPress and UDM, specifically since WordPress 5.5
		 * Due to the new WP's auto-updates interface in WordPress version 5.5, we need to maintain the auto update compatibility on all versions of WordPress and UDM
		 */
		$udm_options = $this->get_option($this->option_name);
		if (empty($udm_options['wp55_option_migrated'])) {
			$this->replace_auto_update_option();
		}

		include(ABSPATH.WPINC.'/version.php');
		if (version_compare($wp_version, '5.5', '<')) {
			add_filter('auto_update_plugin', array($this, 'auto_update_plugin'), 20, 2);
		}

		add_action('wp_loaded', array($this, 'maybe_force_checking_for_updates'));
	}

	/**
	 * Whether to manually force checking for updates by inspecting a specified slug submitted as a query argument (force_udm_check) and build restriction where plugin can only be force checked 2 times a day to prevent abuse
	 *
	 * @return Void
	 */
	public function maybe_force_checking_for_updates() {
		if (!isset($_REQUEST['force_udm_check']) || '' === $_REQUEST['force_udm_check']) return;
		$slug = sanitize_text_field($_REQUEST['force_udm_check']);
		if ($this->slug !== $slug) return;
		header('Content-type: application/json');
		$restriction = $this->get_option('udm_manual_check_for_updates_restriction');
		if (!is_array($restriction)) $restriction = array();
		$time_now = time();
		$wp_current_day = $time_now - ($time_now % 86400);
		if (!isset($restriction[$slug]) || !isset($restriction[$slug]['current_day']) || !is_numeric($restriction[$slug]['current_day']) || !isset($restriction[$slug]['count']) || !is_numeric($restriction[$slug]['count']) || $restriction[$slug]['current_day'] > $wp_current_day || $wp_current_day - $restriction[$slug]['current_day'] > 60*60*24) {
			// If the restriction option doesn't exist, doesn't have a value, has expired, has invalid data type, one of the required variables doesn't exist, or current day doesn't match with what's in the data then set a new one
			$restriction[$slug] = array(
				'current_day' => $wp_current_day,
				'count' => 1
			);
		} elseif ($wp_current_day == $restriction[$slug]['current_day'] && (int) $restriction[$slug]['count'] < 2) {
			$restriction[$slug]['count'] = 2;
		} else {
			echo json_encode(array(
				'code' => 'force_checking_limit_exceeded',
				'data' => $restriction[$slug]['count'],
			));
			exit;
		}
		$this->update_option('udm_manual_check_for_updates_restriction', $restriction);
		$this->plug_updatechecker->checkForUpdates();
		echo json_encode(array(
			'code' => 'success',
			'data' => $restriction[$slug]['count'],
		));
		exit;
	}

	/**
	 * Generate 'site_host_path' option containing the current site URL, which is used for a cloned site checking purpose in future
	 *
	 * @return Boolean True if site_host_path option existed and has just been updated due to having different site address compared to the currently running site, false if either site_host_path didn't exist and has just been added to the database or site_host_path exists and it has the same site address with the currently running site, or if the site URL couldn't be parsed.
	 */
	protected function update_site_host_option() {
		$udm_options = $this->get_option($this->option_name);
		$site_url = parse_url(network_site_url());
		if (false === $site_url) return false;
		$site_host_path = isset($site_url['host']) ? $site_url['host'] : '';
		$site_host_path .= isset($site_url['path']) ? $site_url['path'] : '';
		// if no site_host_path option is set in the database, then add a new one as it will be used for a cloned site checking
		if (!isset($udm_options['site_host_path'])) {
			$udm_options['site_host_path'] = $site_host_path;
			$this->update_option($this->option_name, $udm_options);
		} elseif (strtolower($udm_options['site_host_path']) !== strtolower($site_host_path)) {
			$udm_options['site_host_path'] = $site_host_path;
			$this->update_option($this->option_name, $udm_options);
			return true;
		}
		return false;
	}

	/**
	 * Potentially disconnect a cloned site by unsetting the 'email' option and resetting PUC update cache
	 */
	protected function potentially_disconnect_cloned_site() {
		// If it's a cloned site, other plugins that use the same site ID may have still connected. Just unset the email and clear the PUC update cache so that when the users reconnect they get the warning message about the duplicate site ID issue
		if ($this->update_site_host_option()) {
			$udm_options = $this->get_option($this->option_name);
			if (isset($udm_options['email'])) {
				// Since we're not disconnecting the plugin from the updates server, doing this on cloned sites won't make the entitlement inactive, the user will be able to connect again without getting any issue even the updates server finds the plugin is still connected (active)
				unset($udm_options['email']);
				if ($this->plug_updatechecker) $this->plug_updatechecker->resetUpdateState();
				$this->update_option($this->option_name, $udm_options);
			}
		}
	}

	/**
	 * Loading of translations
	 */
	public function load_text_domain() {
		$domain = 'udmupdater';
		$locale = apply_filters('udmupdater_locale', (is_admin() && function_exists('get_user_locale')) ? get_user_locale() : get_locale(), $domain, $this);

		$mo_file = realpath(dirname(__FILE__).'/languages').'/'.$domain.'-'.$locale.'.mo';

		if (file_exists($mo_file)) load_textdomain($domain, $mo_file);
	}
	
	/**
	 * Set up the updates checker object.
	 *
	 * If successful, the object will be available as $this->plug_updatechecker
	 */
	public function get_puc_updates_checker() {
		
		if (!empty($this->plug_updatechecker)) return;
		
		// Over-ride update mechanism for the plugin
		$puc_dir = $this->get_puc_dir();
		
		if (!is_readable($puc_dir.'/plugin-update-checker.php') && !class_exists('YahnisElsts\PluginUpdateChecker\v5\PucFactory')) return;

		$options = $this->get_option($this->option_name);
		
		$email = isset($options['email']) ? $options['email'] : '';
		
		if (!$email && $this->require_login) return;
		
		// Load the file even if the PucFactory class is already around, as this may get us a later version / avoid a really old + incompatible one
		if (file_exists($puc_dir.'/plugin-update-checker.php')) include_once($puc_dir.'/plugin-update-checker.php');
		
		if ($this->auto_backoff) add_filter('puc_check_now-'.$this->slug, array($this, 'puc_check_now'), 10, 3);

		add_filter('puc_retain_fields-'.$this->slug, array($this, 'puc_retain_fields'));
		// add_filter('puc_request_info_options-'.$this->slug, array($this, 'puc_request_info_options'));

		if (class_exists('YahnisElsts\PluginUpdateChecker\v5\PucFactory')) {
			$this->plug_updatechecker = YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker($this->url, WP_PLUGIN_DIR.'/'.$this->relative_plugin_file, $this->slug, $this->interval_hours);
			$this->plug_updatechecker->addQueryArgFilter(array($this, 'updater_queryargs_plugin'));
			if ($this->debug) $this->plug_updatechecker->debugMode = true;
		}

	}

	/**
	 * Get the directory for the PUC component
	 *
	 * @return String
	 */
	private function get_puc_dir() {
		return file_exists($this->ourdir.'/vendor/yahnis-elsts/plugin-update-checker') ? $this->ourdir.'/vendor/yahnis-elsts/plugin-update-checker' : ( file_exists(dirname(dirname($this->ourdir)).'/yahnis-elsts/plugin-update-checker') ? dirname(dirname($this->ourdir)).'/yahnis-elsts/plugin-update-checker' : $this->ourdir.'/puc');
	}
	
	/**
	 * WordPress filter - decision on whether to update a plugin
	 *
	 * @param Boolean $update
	 * @param Object $item
	 *
	 * @return Boolean
	 */
	public function auto_update_plugin($update, $item) {

		if (!isset($item->slug) || $item->slug != $this->slug || !$this->allow_auto_updates) return $update;

		$option_auto_update_settings = (array) get_site_option('auto_update_plugins', array());
		
		$update = in_array($item->plugin, $option_auto_update_settings, true);
		
		if ($this->debug) error_log("udm_updater: ".$this->slug." auto update decision: ".$update);
		
		return $update;
	}
	
	/**
	 * Process admin-ajax.php requests
	 */
	public function udmupdater_ajax() {
		if (empty($_REQUEST['nonce']) || empty($_REQUEST['subaction']) || !wp_verify_nonce($_REQUEST['nonce'], 'udmupdater-ajax-nonce')) die('Security check.');

		// Make sure this request is meant for us
		if (empty($_REQUEST['userid']) || empty($_REQUEST['slug']) || $this->muid != $_REQUEST['userid'] || $_REQUEST['slug'] != $this->slug) return;

		$this->update_site_host_option();
		if ('connect' == $_REQUEST['subaction'] && current_user_can('update_plugins')) {
			$this->connect();
			die;
		} elseif ('disconnect' == $_REQUEST['subaction'] && current_user_can('update_plugins')) {
			$this->disconnect();
			die();
		} elseif ('dismissexpiry' == $_REQUEST['subaction']) {

			$option = $this->get_option($this->option_name);
			if (!is_array($option)) $option = array();
			$option['dismissed_until'] = time() + 28*86400;
			$this->update_option($this->option_name, $option);
			
		} elseif ('change_auto_update' == $_REQUEST['subaction']) {
		
			$auto_update = empty($_REQUEST['auto_update']) ? false : true;
			
			if ($auto_update) {
				$this->enable_automatic_updates();
			} else {
				$this->disable_automatic_updates();
			}
			
			echo json_encode(array(
				'code' => $auto_update ? 'active' : 'inactive',
			));
		
		}
		
		die;
	}

	/**
	 * WordPress action admin_menu
	 */
	public function admin_menu() {
	
		global $pagenow;

		// Do we want to display a notice about the upcoming or past expiry of their subscription?
		if (!empty($this->plug_updatechecker) && !empty($this->plug_updatechecker->optionName) && current_user_can('update_plugins')) {
			#(!is_multisite() && 'options-general.php' == $pagenow) || (is_multisite() && 'settings.php' == $pagenow) ||
			if ('plugins.php' == $pagenow || 'update-core.php' == $pagenow || (('options-general.php' == $pagenow || 'admin.php' == $pagenow) && !empty($_REQUEST['page']) && $this->slug == $_REQUEST['page'])) {
				$do_expiry_check = true;
				$dismiss = '';
			} elseif (is_admin()) {

				$options = $this->get_option($this->option_name);

				$dismissed_until = empty($options['dismissed_until']) ? 0 : $options['dismissed_until'];

				if ($dismissed_until <= time()) {
					$do_expiry_check = true;
					$dismiss = '<div style="float:right; position: relative; top:-24px;" class="ud-'.esc_js($this->slug).'-expiry-dismiss"><a href="#" onclick="jQuery(\'.ud-'.esc_js($this->slug).'-expiry-dismiss\').parent().slideUp(); jQuery.post(ajaxurl, {action: \'udmupdater_ajax\', subaction: \'dismissexpiry\', userid: \''.esc_js($this->muid).'\', slug: \''.esc_js($this->slug).'\', nonce: \''.wp_create_nonce('udmupdater-ajax-nonce').'\' });">'.sprintf(__('Dismiss from main dashboard (for %s weeks)', 'udmupdater'), apply_filters('udmupdater_defaultdismiss', 4, $this->slug)).'</a></div>';
				}
			}
		}

		$oval = is_object($this->plug_updatechecker) ? get_site_option($this->plug_updatechecker->optionName, null) : null;
		$updateskey = 'x-spm-expiry';
		$supportkey = 'x-spm-support-expiry';
		$subscription_active = 'x-spm-subscription-active';

		$yourversionkey = 'x-spm-yourversion-tested';

		$plugin_title = htmlspecialchars($this->get_plugin_data('Name'));
		$please_renew = __('please renew', 'udmupdater');
		
		if (is_object($oval) && !empty($oval->update) && is_object($oval->update) && !empty($oval->update->homepage)) {
			$plugin_title = '<a href="'.esc_url($oval->update->homepage).'">'.$plugin_title.'</a>';
			$please_renew = '<a href="'.esc_url($oval->update->homepage).'">'.$please_renew.'</a>';
		}
		
		if (is_object($oval) && !empty($oval->update) && is_object($oval->update) && !empty($oval->update->extraProperties[$yourversionkey]) && current_user_can('update_plugins') && true == apply_filters('udmanager_showcompatnotice', true, $this->slug) && (!defined('UDMANAGER_DISABLECOMPATNOTICE') || true != UDMANAGER_DISABLECOMPATNOTICE)) {

			// Prevent false-positives
			if (file_exists(dirname($this->plugin_file).'/readme.txt') && $fp = fopen(dirname($this->plugin_file).'/readme.txt', 'r')) {
				$file_data = fread($fp, 1024);
				if (preg_match("/Tested up to: (\d+\.\d+).*(\r|\n)/", $file_data, $matches)) {
					$readme_says = $matches[1];
				}
				fclose($fp);
			}

			global $wp_version;
			include(ABSPATH.WPINC.'/version.php');
			$compare_wp_version = (preg_match('/^(\d+\.\d+)\..*$/', $wp_version, $wmatches)) ? $wmatches[1] : $wp_version;
			$compare_tested_version = $oval->update->extraProperties[$yourversionkey];
			if (!empty($readme_says) && version_compare($readme_says, $compare_tested_version, '>')) $compare_tested_version = $readme_says;
			#$compare_tested_version = (preg_match('/^(\d+\.\d+)\.*$/', $oval->update->$yourversionkey, $wmatches)) ? $wmatches[1] : $oval->update->$yourversionkey;
			
			if (version_compare($compare_wp_version, $compare_tested_version, '>')) {
				$this->admin_notices['yourversiontested'] = '<strong>'.__('Warning', 'udmupdater').':</strong> '.sprintf(__('The installed version of %s has not been tested on your version of WordPress (%s).', 'udmupdater'), $plugin_title, $wp_version).' '.sprintf(__('It has been tested up to version %s.', 'udmupdater'), $compare_tested_version).' '.__('You should update to make sure that you have a version that has been tested for compatibility.', 'udmupdater');
			}
		}

		if (!empty($do_expiry_check) && is_object($oval) && !empty($oval->update) && is_object($oval->update) && !empty($oval->update->extraProperties[$updateskey])) {
			if (preg_match('/(^|)expired_?(\d+)?(,|$)/', $oval->update->extraProperties[$updateskey], $matches)) {
			
				if (empty($matches[2])) {
					$this->admin_notices['updatesexpired'] = sprintf(__('Your paid access to %s updates for this site has expired. You will no longer receive updates.', 'udmupdater'), $plugin_title).' '.sprintf(__('To regain access to updates (including future features and compatibility with future WordPress releases) and support, %s.', 'udmupdater'), $please_renew).$dismiss;
				} else {
					$this->admin_notices['updatesexpired'] = sprintf(__('Your paid access to %s updates for %s add-ons on this site has expired.', 'udmupdater'), $plugin_title, $matches[2]).' '.sprintf(__('To regain access to updates (including future features and compatibility with future WordPress releases) and support, %s.', $please_renew)).$dismiss;
				}
			}
			// If the licence is expiring soon but they still have an active subscription then we don't want to show the notice.
			$subscription_active = empty($oval->update->extraProperties[$subscription_active]) ? false : $oval->update->extraProperties[$subscription_active];
			$subscription_status = apply_filters('udmupdater_subscription_active', $subscription_active);
			if (empty($subscription_status)) {
				if (preg_match('/(^|,)soonpartial_(\d+)_(\d+)($|,)/', $oval->update->extraProperties[$updateskey], $matches)) {
					$this->admin_notices['updatesexpiringsoon'] = sprintf(__('Your paid access to %s updates for %s of the %s add-ons on this site will soon expire.', 'udmupdater'), $plugin_title, $matches[2], $matches[3]).' '.sprintf(__('To retain your access, and maintain access to updates (including future features and compatibility with future WordPress releases) and support, %s.', 'udmupdater'), $please_renew).$dismiss;
				} elseif (preg_match('/(^|,)soon($|,)/', $oval->update->extraProperties[$updateskey])) {
					$this->admin_notices['updatesexpiringsoon'] = sprintf(__('Your paid access to %s updates for this site will soon expire.', 'udmupdater'), $plugin_title).' '.sprintf(__('To retain your access, and maintain access to updates (including future features and compatibility with future WordPress releases) and support, %s.', 'udmupdater'), $please_renew).''.$dismiss;
				}
			}
		} elseif (!empty($do_expiry_check) && is_object($oval) && !empty($oval->update) && is_object($oval->update) && !empty($oval->update->extraProperties[$supportkey])) {
			if ('expired' == $oval->update->extraProperties[$supportkey]) {
				$this->admin_notices['supportexpired'] = sprintf(__('Your paid access to %s support has expired.','udmupdater'), $plugin_title).' '.sprintf(__('To regain your access, %s.', 'udmupdater'), $please_renew).$dismiss;
			} elseif ('soon' == $oval->update->extraProperties[$supportkey]) {
				$this->admin_notices['supportsoonexpiring'] = sprintf(__('Your paid access to %s support will soon expire.','udmupdater'), $plugin_title).' '.sprintf(__('To maintain your access to support, %s.', 'udmupdater'), $please_renew).$dismiss;
			}
		}

		add_action('all_admin_notices', array($this, 'admin_notices'));

		// Refresh, if specifically requested
		if (('options-general.php' == $pagenow) || (is_multisite() && 'settings.php' == $pagenow) && isset($_GET['udm_refresh'])) {
			if ($this->plug_updatechecker) $this->plug_updatechecker->checkForUpdates();
		}

	}

	/**
	 * WordPress filter puc_retain_fields-(slug)
	 *
	 * @param Array $f
	 *
	 * @return Array
	 */
	public function puc_retain_fields($f) {
		if (!is_array($f)) return $f;
		if (!in_array('extraProperties', $f)) $f[] = 'extraProperties';
		return $f;
	}

	/**
	 * WordPress action admin_notices
	 */
	public function admin_notices() {
		foreach ($this->admin_notices as $key => $notice) {
			$notice = '<span style="font-size: 115%;">'.$notice.'</span>';
			if (is_numeric($key)) {
				$this->show_admin_warning($notice);
			} else {
				$this->show_admin_warning($notice, 'error');
			}
		}
	}

	/**
	 * WordPress action core_upgrade_preamble
	 */
	public function core_upgrade_preamble() {
		if (!current_user_can('update_plugins')) return;
		$this->potentially_disconnect_cloned_site();
		if (!$this->is_connected()) $this->admin_notice_not_connected();
	}

	/**
	 * WordPress action load-plugins.php
	 */
	public function load_plugins_php() {
		if (!current_user_can('update_plugins')) return;
		$this->potentially_disconnect_cloned_site();
		$this->add_admin_notice_if_not_connected();
	}

	/**
	 * Returns the state, as to whether we already have a connection or not
	 *
	 * @return Boolean
	 */
	protected function is_connected() {
		$option = $this->get_option($this->option_name);
		return empty($option['email']) ? false : true;
	}

	/**
	 * Add an admin notice, depending on whether we are currently connected or not
	 */
	protected function add_admin_notice_if_not_connected() {
		if ($this->is_connected()) return;
		add_action('all_admin_notices', array($this, 'admin_notice_not_connected'));
	}

	/**
	 * Output the contents of an admin notice
	 */
	public function admin_notice_not_connected() {
		echo '<div class="updated" id="udmupdater_not_connected" style="width: 97%; float:left">';
		$plugin_label = htmlspecialchars($this->get_plugin_data('Name'));
		echo apply_filters('udmupdater_updateradminnotice_header', '<h3>'.sprintf(__('Access to plugin updates (%s)', 'udmupdater'), $plugin_label).'</h3>', $this->get_plugin_data());
		$this->print_plugin_connector_box();
		echo '</div>';
		echo "<script>
		jQuery(window).on('load', function() {
			jQuery('#udmupdater_not_connected').appendTo(jQuery('#wpbody-content div.wrap form').first());
		});
		</script>";
	}

	/**
	 * WordPres action after_plugin_row_($relative_plugin_file)
	 *
	 * @param String $file
	 */
	public function after_plugin_row($file) {
		if (!current_user_can('update_plugins')) return;

		$wp_list_table = _get_list_table('WP_Plugins_List_Table');

		echo '<tr class="plugin-update-tr active" style="border-top: none;"><td colspan="' . esc_attr( $wp_list_table->get_column_count() ) . '" class="colspanchange">';
		
		$this->print_plugin_connector_box();

		echo '</td></tr>';
	}

	/**
	 * WordPress action admin_footer
	 */
	public function admin_footer() {
		?>
		<script>
			var udmupdaterl10n = <?php echo json_encode($this->udmupdaterl10n, JSON_PRETTY_PRINT)."\n"; ?>
			jQuery(function($) {
				var nonce = '<?php echo esc_js(wp_create_nonce('udmupdater-ajax-nonce')); ?>';
				$('.udmupdater_userpassform_<?php echo esc_js($this->slug);?> .udmupdater-connect').on('click', function() {
					var button = this;
					var $box = $(this).closest('.udmupdater_userpassform');
					var email = $box.find('input[name="email"]').val();
					var password = $box.find('input[name="password"]').val();
					if (email == '' || password == '') {
						alert('<?php echo esc_js(
							apply_filters('udmupdater_need_credentials_message', 
								sprintf(
									__('You need to enter both an email address and a %s', 'udmupdater'),
									apply_filters('udmupdater_password_description', __('password', 'udmupdater'), $this->slug, $this->get_plugin_data())
								)
							)
						);?>');
						return false;
					}
					var sdata = {
						action: 'udmupdater_ajax',
						subaction: 'connect',
						nonce: nonce,
						userid: <?php echo $this->muid;?>,
						slug: '<?php echo esc_js($this->slug);?>',
						email: email,
						password: password
					}
					$(this).prop('disabled', true).html('<?php echo esc_js(__('Connecting...', 'udmupdater')); ?>');
					$.post(ajaxurl, sdata, function(response, data) {
						$(button).prop('disabled', false).html('<?php echo esc_js(__('Connect', 'udmupdater')); ?>');
						try {
							resp = JSON.parse(response);
							if (resp.hasOwnProperty('code')) {
								console.log('Code: '+resp.code);
								if (resp.code == 'INVALID') {
									alert('<?php echo esc_js(__('The response from the remote site could not be decoded. (More information is recorded in the browser console).', 'udmupdater'));?>');
									console.log(resp);
								} else if (resp.code == 'BADAUTH') {
									if (resp.hasOwnProperty('data')) {
										alert(resp.msg);
									} else {
										alert('<?php echo esc_js(sprintf(
											__('Your email address and %s were not recognised.', 'udmupdater'), apply_filters('udmupdater_password_description', __('password', 'udmupdater'), $this->slug, $this->get_plugin_data())
										));?>');
										console.log(resp);
									}
								} else if (resp.code == 'OK') {
									if (resp.hasOwnProperty('was_previously_sharing_licence')) {
										$('div.udmupdater_box_<?php echo esc_js($this->slug);?> div.udmupdater_duplicate_site_warning').empty().text(udmupdaterl10n.duplicate_site_id);
										$('div.udmupdater_box_<?php echo esc_js($this->slug);?> div.udmupdater_duplicate_site_warning').slideDown();
									}
									alert('<?php echo esc_js(__('You have successfully connected for access to updates to this plugin.', 'udmupdater'));?>');
									if (!resp.hasOwnProperty('was_previously_sharing_licence')) {
										$('div.udmupdater_box_<?php echo esc_js($this->slug);?> div.udmupdater_duplicate_site_warning').empty();
										$('.udmupdater_box_<?php echo esc_js($this->slug);?>').parent().slideUp();
									}
								} else if (resp.code == 'ERR') {
									alert('<?php echo esc_js(__('Your login was accepted, but no available entitlement for this plugin was found.', 'udmupdater').' '.__('Has your licence expired, or have you used all your available licences elsewhere?', 'udmupdater'));?>');
									console.log(resp);
								} else {
									console.log(resp);
									alert(resp.data);
								}
							} else {
								alert('<?php echo esc_js(__('The response from the remote site could not be decoded. (More information is recorded in the browser console).', 'udmupdater'));?>');
								console.log('No response code found');
								console.log(resp);
							}
						} catch (e) {
							alert('<?php echo esc_js(__('The response from the remote site could not be decoded. (More information is recorded in the browser console).', 'udmupdater'));?>');
							console.log(e);
							console.log(response);
						}
					});
					return false;
				});

				$('#udmupdater_autoupdate_<?php echo esc_js($this->slug);?>').on('change', function() {
					
					var checked = $(this).is(':checked') ? 1 : 0;
					
					var sdata = {
						action: 'udmupdater_ajax',
						subaction: 'change_auto_update',
						nonce: nonce,
						auto_update: checked,
						userid: <?php echo $this->muid;?>,
						slug: '<?php echo esc_js($this->slug);?>'
					}
					
					var button = this;
					
					$(this).prop('disabled', true);
					
					$.post(ajaxurl, sdata, function(response, data) {
						$(button).prop('disabled', false);
						try {
							resp = JSON.parse(response);
							if (resp.hasOwnProperty('code')) {
								if ('active' == resp.code) {
									alert('<?php echo esc_js(__('When updates to this plugin are available, they will be automatically installed.', 'udmupdater'));?>');
								} else {
									alert('<?php echo esc_js(__('When updates to this plugin are available, they will not be automatically installed.', 'udmupdater'));?>');
								}
							} else {
								alert('<?php echo esc_js(__('The response from the remote site could not be decoded. (More information is recorded in the browser console).', 'udmupdater'));?>');
								console.log('No response code found');
								console.log(resp);
							}
						} catch (e) {
							alert('<?php echo esc_js(__('The response from the remote site could not be decoded. (More information is recorded in the browser console).', 'udmupdater'));?>');
							console.log(e);
							console.log(response);
						}
					});
				});

				$('.udmupdater_userpassform_<?php echo esc_js($this->slug);?> .udmupdater-disconnect').on('click', function() {
					var button = this;
					var $box = $(this).closest('.udmupdater_userpassform');
					var sdata = {
						action: 'udmupdater_ajax',
						subaction: 'disconnect',
						nonce: nonce,
						userid: <?php echo $this->muid;?>,
						slug: '<?php echo esc_js($this->slug);?>'
					}
					$(this).prop('disabled', true).html('<?php echo esc_js(__('Disconnecting...', 'udmupdater')); ?>');
					$.post(ajaxurl, sdata, function(response, data) {
						$(button).prop('disabled', false).html('<?php echo esc_js(__('Disconnect', 'udmupdater')); ?>');
						try {
							resp = JSON.parse(response);
							if (resp.hasOwnProperty('code')) {
							
								if ('BADAUTH' == resp.code && resp.hasOwnProperty('data') && 'invaliduser' == resp.data) {
									alert('<?php echo esc_js(__('Your email address was not recognised. The connection information will be removed from this site.', 'udmupdater'));?>');
									$('.udmupdater_box_<?php echo esc_js($this->slug);?>').parent().slideUp();
								
								} else {
							
									alert('<?php echo esc_js(__('You have successfully disconnected access to updates to this plugin.', 'udmupdater'));?>');
									$('.udmupdater_box_<?php echo esc_js($this->slug);?>').parent().slideUp();
								
								}
							} else {
								alert('<?php echo esc_js(__('The response from the remote site could not be decoded. (More information is recorded in the browser console).', 'udmupdater'));?>');
								console.log('No response code found');
								console.log(resp);
							}
						} catch (e) {
							alert('<?php echo esc_js(__('The response from the remote site could not be decoded. (More information is recorded in the browser console).', 'udmupdater'));?>');
							console.log(e);
							console.log(response);
						}
					});
					return false;
				});

			});
		</script>
		<?php
	}
	
	/**
	 * Set whether the plugin should be automatically updated
	 *
	 * @param Boolean
	 */
	public function set_allow_auto_updates($allow_auto_updates = true) {
		$this->allow_auto_updates = (bool)$allow_auto_updates;
	}

	/**
	 * Get the current stat as to whether the plugin should be automatically updated
	 *
	 * @return Boolean
	 */
	public function get_allow_auto_updates() {
		return $this->allow_auto_updates;
	}

	/**
	 * Outputs the HTML for the connection box
	 */
	protected function print_plugin_connector_box() {

		// Are we already connected?

		$options = $this->get_option($this->option_name);
		$email = isset($options['email']) ? $options['email'] : '';
		$duplicate_site = isset($options['was_previously_sharing_licence']) && false === $options['was_previously_sharing_licence'];

		if (!$this->connector_footer_added) {
			$this->connector_footer_added = true;
			add_action('admin_footer', array($this, 'admin_footer'));
		}

		$plugin_label = htmlspecialchars($this->get_plugin_data('Name'));
		if ($this->get_plugin_data('PluginURI')) $plugin_label = '<a href="'.esc_attr($this->get_plugin_data('PluginURI')).'">'.$plugin_label.'</a>';

		?>
		<div style="margin: 10px;  min-height: 36px;" class="udmupdater_box_<?php echo esc_attr($this->slug);?>">
			<?php if ($this->is_connected()) { ?>
			<div style="float: left; margin-right: 14px; margin-top: 4px;">
				<em><?php echo apply_filters('udmupdater_you_are_connected', sprintf(__('You are connected to receive updates for %s (login: %s)', 'udmupdater'), $plugin_label, htmlspecialchars($email)), $this->get_plugin_data(), $this->slug); ?></em>: 
			</div>
			<div class="udmupdater_userpassform udmupdater_userpassform_<?php echo esc_attr($this->slug);?>" style="float:left;">
				<button class="button button-primary udmupdater-disconnect"><?php _e('Disconnect', 'udmupdater');?></button>
			</div>
			<?php } else { ?>
			<div class="udmupdater_duplicate_site_warning" style="<?php if (!$duplicate_site) echo 'display: none'; ?>"><?php if ($duplicate_site) echo esc_html($this->udmupdaterl10n['duplicate_site_id']); ?></div>
			<div style="float: left; margin-right: 14px; margin-top: 4px;">
				<em><?php echo apply_filters('udmupdater_entercustomerlogin', sprintf(__('Please enter your customer login to access updates for %s', 'udmupdater'), $plugin_label), $this->get_plugin_data()); ?></em>: 
			</div>
			<div class="udmupdater_userpassform udmupdater_userpassform_<?php echo esc_attr($this->slug);?>" style="float:left;">
				<input type="text" style="width:180px;" placeholder="<?php echo esc_attr(__('Email', 'udmupdater')); ?>" name="email" value="">
				<input type="password" style="width:180px;" placeholder="<?php echo esc_attr(ucfirst(apply_filters('udmupdater_password_description', __('password', 'udmupdater'), $this->slug, $this->get_plugin_data()))); ?>" name="password" value="">
				<button class="button button-primary udmupdater-connect"><?php _e('Connect', 'udmupdater');?></button>
			</div>
			<?php } ?>
			<?php if (apply_filters('udmupdater_autoupdate_form', $this->allow_auto_updates, $this->slug)) {
				$checkbox_id = 'udmupdater_autoupdate_'.$this->slug;
				?>
				<div class="udmupdater_autoupdate" style="clear:left;">
					<input type="checkbox" id="<?php echo esc_attr($checkbox_id);?>" <?php if ($this->is_automatic_updating_enabled()) echo 'checked="checked"';?>>
					<label for="<?php echo esc_attr($checkbox_id);?>"><?php echo apply_filters('udmupdater_automatically_update_when_available', __('Automatically update as soon as an update becomes available (N.B. other plugins can over-ride this setting).', 'udmupdater'), $this->slug);?></label>
				</div>
			<?php } ?>
		</div>
		<?php
	}

	/**
	 * WordPress action plugins_loaded
	 */
	public function plugins_loaded() {
		load_plugin_textdomain('udmupdater', false, basename(dirname(__FILE__)).'/languages');
	}

	/**
	 * WordPress filter puc_check_now-(slug). A decision on whether to check for updates now; we want to lessen the number of automatic checks if an update is already known to be available
	 *
	 * @param Boolean $shouldcheck
	 * @param Integer $lastcheck (UNIX time)
	 * @param Integer $checkperiod
	 *
	 * @return Boolean
	 */
	public function puc_check_now($shouldcheck, $lastcheck, $checkperiod) {

		// Skip checks immediately after a WP upgrade. This action has existed since WP 4.4. Since we're just trying to reduce server load spikes when WP core automatic security upgrades happen, that is adequate.
		if (did_action('pre_auto_update') && apply_filters('udmupdater_skip_after_auto_upgrade', true, $this->slug)) return false;

		global $wp_current_filter;
		if (true !== $shouldcheck || empty($this->plug_updatechecker) || 0 == $lastcheck || in_array('load-update-core.php', $wp_current_filter) || !defined('DOING_CRON')) return $shouldcheck;

		if (null === $this->plug_updatechecker->getUpdate()) return $shouldcheck;

		$days_since_check = max(round((time() - $lastcheck)/86400), 1);
		if ($days_since_check > 10000) return true;

		# Suppress checks on days 2, 4, 5, 7 and then every day except multiples of 7.
		if (2 == $days_since_check || 4 == $days_since_check || 5 == $days_since_check || 7 == $days_since_check || ($days_since_check >= 7 && $days_since_check % 7 != 0)) return false;

		return true;
	}

	/**
	 * Add extra parameters to the updates query
	 *
	 * @param Array $args
	 *
	 * @return Array
	 */
	public function updater_queryargs_plugin($args) {
		if (!is_array($args)) return $args;

		$options = $this->get_option($this->option_name);
		$email = isset($options['email']) ? $options['email'] : '';

		$args['udm_action'] = 'updateinfo';
		$args['sid'] = $this->site_id();
		$args['su'] = urlencode(base64_encode(network_site_url()));
		$args['home_url'] = urlencode(base64_encode(home_url()));
		$args['sn'] = urlencode(base64_encode(get_bloginfo('name')));
		$args['slug'] = urlencode($this->slug);
		$args['e'] = urlencode($email);

		$sinfo = $this->get_site_info();

		$args['si2'] = urlencode(base64_encode(json_encode($sinfo)));

		// These are added by versions 4.0+ of the updates checker. We remove them because of the redundancy.
		unset($args['php']);
		unset($args['locale']);
		
		return $args;
	}
	
	/**
	 * Get information on this WP install
	 *
	 * @return Array - site information
	 */
	public function get_site_info() {
		// Some information on the server calling. This can be used - e.g. if they have an old version of PHP/WordPress, then this may affect what update version they should be offered
		include(ABSPATH.'wp-includes/version.php');
		global $wp_version;
		$sinfo = array(
			'wp' => $wp_version,
			'php' => PHP_VERSION,
			'multi' => is_multisite() ? 1 : 0,
			'mem' => ini_get('memory_limit'),
			'lang' => get_locale()
		);

		if ($this->get_plugin_data('Version')) {
			$sinfo['pver'] = $this->get_plugin_data('Version');
		}
		
		return $sinfo;
	}

	/**
	 * Funnelling through here allows for future flexibility
	 *
	 * @param String $option
	 *
	 * @return Mixed
	 */
	public function get_option($option) {
		if (is_multisite()) {
			return get_site_option($option);
		} else {
			return get_option($option);
		}
	}

	/**
	 * Funnelling through here allows for future flexibility
	 *
	 * @param String $option
	 * @param Mixed $val
	 *
	 * @return Boolean
	 */
	public function update_option($option, $val) {
		if (is_multisite()) {
			return update_site_option($option, $val);
		} else {
			// On non-multisite, this results in storing in the same place - but also sets 'autoload' to true, which update_site_option() does not
			return update_option($option, $val, true);
		}
	}

	/**
	 * Output the HTML for a dashboard message
	 *
	 * @param String $message
	 * @param String $class
	 */
	public function show_admin_warning($message, $class = "updated") {
		echo '<div class="updraftmanagermessage '.$class.'">'."<p>$message</p></div>";
	}

	/**
	 * WordPress filter site_transient_update_plugins - used to remove any results from wordpress.org for the same slug.
	 *
	 * @param Object $updates
	 *
	 * @return Object
	 */
	public function site_transient_update_plugins($updates) {
		if (!is_object($updates) || empty($this->plugin_file)) return $updates;
		if (isset($updates, $updates->response, $updates->response[$this->plugin_file])) {
			unset($updates->response[$this->plugin_file]);
		}
		return $updates;
	}

	/**
	 * Get a reasonably unique identifier for the site
	 *
	 * @return String
	 */
	protected function site_id() {
		$use_slug = 'updater';
		$sid = get_site_option('udmanager_'.$use_slug.'_sid');
		if (!is_string($sid)) {
			$sid = md5(rand().time().network_site_url());
			update_site_option('udmanager_'.$use_slug.'_sid', $sid);
		}
		return $sid;
	}

	/**
	 * Get the plugin's data.
	 *
	 * @param string $key - The key of the data required. Empty by default (the empty string returns the whole plugin_data object).
	 *
	 * @return mixed
	 */
	protected function get_plugin_data($key = '') {
		if (null === $this->plugin_data) {
			if (!function_exists('get_plugin_data')) require_once(ABSPATH.'wp-admin/includes/plugin.php');
			$this->plugin_data = get_plugin_data($this->plugin_file);
		}
		if ('' === $key) return $this->plugin_data;
		if (isset($this->plugin_data[$key])) {
			return $this->plugin_data[$key];
		}
		return false;
	}

	/**
	 * Remove the use of auto_update index and its value from the *_updater_options option/meta (single/multisite) and change it to auto_update_plugins site option, which is also used by WordPress's core since version 5.5
	 * This needs to be done in order to maintain auto-updates compatibility between WordPress and UDM and to synchronise the auto-updates setting for both
	 */
	protected function replace_auto_update_option() {
		$options = $this->get_option($this->option_name);
		if (!is_array($options)) $options = array();
		$old_setting_value = isset($options['auto_update']) ? $options['auto_update'] : '';
		$new_setting_value = (array) get_site_option('auto_update_plugins', array());
		if (!empty($old_setting_value)) $new_setting_value[] = $this->relative_plugin_file;
		$new_setting_value = array_unique($new_setting_value);
		unset($options['auto_update']);
		$options['wp55_option_migrated'] = true;
		$this->update_option($this->option_name, $options);
		update_site_option('auto_update_plugins', $new_setting_value);
	}

	/**
	 * Enable automatic updates for UDM
	 */
	protected function enable_automatic_updates() {
		$auto_update_plugins = (array) get_site_option('auto_update_plugins', array());
		$auto_update_plugins[] = $this->relative_plugin_file;
		$auto_update_plugins = array_unique($auto_update_plugins);
		update_site_option('auto_update_plugins', $auto_update_plugins);
	}

	/**
	 * Disable automatic updates for UDM
	 */
	protected function disable_automatic_updates() {
		$auto_update_plugins = (array) get_site_option('auto_update_plugins', array());
		$auto_update_plugins = array_diff($auto_update_plugins, array($this->relative_plugin_file));
		update_site_option('auto_update_plugins', $auto_update_plugins);
	}

	/**
	 * Check whether the automatic-updates is set for UDM
	 *
	 * @return Boolean True if set, false otherwise
	 */
	protected function is_automatic_updating_enabled() {
		$auto_update_plugins = (array) get_site_option('auto_update_plugins', array());
		return in_array($this->relative_plugin_file, $auto_update_plugins, true);
	}

	/**
	 * Disconnect access to updates to the plugin
	 */
	protected function disconnect() {
		$options = $this->get_option($this->option_name);

		if (empty($options['email'])) {
			echo json_encode(array(
				'code' => 'INVALID',
				'data' => 'Not connected (no email found)'
			));
		} else {
			$result = wp_remote_post($this->url.'&udm_action=releaseaddon&slug='.urlencode($_POST['slug']).'&e='.urlencode($options['email']),
				apply_filters('udmupdater_wp_api_options', array(
					'timeout' => 10,
					'body' => array(
						'e' => $options['email'],
						'sid' => $this->site_id(),
						'slug' => $_POST['slug']
					)
				), 'releaseaddon')
			);

			if (is_array($result) && isset($result['body'])) {

				$decoded = json_decode($result['body'], true);
				if (empty($decoded)) {
					echo json_encode(array(
						'code' => 'INVALID',
						'data' => $result['body']
					));
				} else {
					echo $result['body'];
					// Disconnect if their email address was not recognised; they probably changed it (and they're not going to be able to get any updates if it's not recognised anyway).
					if (isset($decoded['code']) && ('OK' == $decoded['code'] || ('BADAUTH' == $decoded['code'] && isset($decoded['data']) && 'invaliduser' === $decoded['data']))) {
						$option = $this->get_option($this->option_name);
						if (!is_array($option)) $option = array();
						unset($option['email']);
						$this->update_option($this->option_name, $option);
					}
				}

			} elseif (is_wp_error($result)) {
				echo json_encode(array(
					'code' => 'WP_ERROR',
					'data' => __('Errors occurred:','udmupdater').' '.$result->get_error_message()
				));
			} else {
				echo json_encode(array(
					'code' => 'UNKNOWN_ERR',
					'data' => __('Errors occurred:','udmupdater').' '.htmlspecialchars(serialize($result))
				));
			}
		}
	}

	/**
	 * Connect to the updates server
	 */
	private function connect() {
		$options = $this->get_option($this->option_name);

		$email = stripslashes($_POST['email']);
		
		$result = wp_remote_post($this->url.'&udm_action=claimaddon&slug='.urlencode($this->slug).'&e='.urlencode($email),
			apply_filters('udmupdater_wp_api_options', array(
				'timeout' => 10,
				'body' => array(
					'e' => $email,
					'p' => base64_encode($_POST['password']),
					'sid' => $this->site_id(),
					'sn' => base64_encode(get_bloginfo('name')),
					'su' => base64_encode(network_site_url()),
					'home_url' => base64_encode(home_url()),
					'slug' => $this->slug,
					'si2' => json_encode($this->get_site_info())
				)
			), 'claimaddon')
		);

		if (is_array($result) && isset($result['body'])) {

			$decoded = json_decode($result['body'], true);
			
			if (empty($decoded)) {
				echo json_encode(array(
					'code' => 'INVALID',
					'data' => $result['body']
				));
			} else {
				// Save the new settings first, so that they can then possibly be used
				if (isset($decoded['code']) && 'OK' == $decoded['code']) {
					$option = $this->get_option($this->option_name);
					if (!is_array($option)) $option = array();
					$option['email'] = $email;
					$this->update_option($this->option_name, $option);
					if ((isset($decoded['data']) && isset($decoded['data']['plugin_info']) && isset($decoded['data']['plugin_info']['x-spm-duplicate-of'])) || (isset($option['duplicate_site_is_connected']) && $option['duplicate_site_is_connected'])) {
						$option['duplicate_site_is_connected'] = true;
						$decoded['duplicate_site_is_connected'] = true;
						$this->update_option($this->option_name, $option);
						ob_start();
						$this->disconnect();
						$connection_result = ob_get_clean();
						$decoded = json_decode($connection_result, true);
						if (!is_array($decoded)) $decoded = array();
						if (isset($decoded['code']) && 'OK' === $decoded['code']) {
							delete_site_option('udmanager_updater_sid');
							$option['duplicate_site_is_connected'] = false;
							$option['was_previously_sharing_licence'] = true;
							$this->update_option($this->option_name, $option);
							$this->connect();
							exit;
						} else {
							unset($option['email']); // though the disconnect() method will unset this, it'd be good if we also unset this just in case the disconnect() method fails and returns an unrecognised code
						}
					} else {
						if (isset($option['was_previously_sharing_licence'])) {
							$decoded['was_previously_sharing_licence'] = $option['was_previously_sharing_licence'];
							unset($option['was_previously_sharing_licence']);
						}
						if (isset($option['duplicate_site_is_connected'])) unset($option['duplicate_site_is_connected']);
					}
					$this->update_option($this->option_name, $option);
					$result['body'] = json_encode($decoded);
				}
				
				do_action('udmupdater_connect_result', $decoded, $this, $email);

				echo $result['body'];
				
				if (isset($decoded['data']) && isset($decoded['data']['plugin_info'])) {
					$plugin_info = $decoded['data']['plugin_info'];
					
					$this->get_puc_updates_checker();
					
					// e.g. Puc_v4p6_Plugin_UpdateChecker
					$checker_class = get_class($this->plug_updatechecker);
					
					// Hopefully take off the 'Checker'. The setUpdate() call below wants a compatible version.
					$plugin_update_class = substr($checker_class, 0, strlen($checker_class)-7);
					
					if (class_exists($plugin_update_class) && is_callable(array($plugin_update_class, 'fromObject')) && !empty($this->plug_updatechecker)) {

						// $plugin_update_class::fromObject() is invalid syntax on PHP 5.2
						// Puc_v4pxx_Plugin_Update::fromObject() method (according to its docblock) accepts only object type for its parameter, passing an array produces a PHP fatal error on PHP 8.x, but still works on other PHP versions prior to 8.0
						// we now that $plugin_info will always be an array and will never be a string, so no need to add a check for that we can just cast it into an object
						$plugin_update = call_user_func(array($plugin_update_class, 'fromObject'), (object) $plugin_info);
						
						$update_checker = $this->plug_updatechecker;
						
						$installed_version = $update_checker->getInstalledVersion();

						if (null !== $installed_version) {
							$state = $update_checker->getUpdateState();
							$state->setLastCheckToNow()->setCheckedVersion($installed_version);
							$state->setUpdate($plugin_update);
							$state->save();
						}
						
					}

				}
				
			}
		} elseif (is_wp_error($result)) {
			echo json_encode(array(
				'code' => 'WP_ERROR',
				'data' => __('Errors occurred:','udmupdater').' '.$result->get_error_message()
			));
		} else {
			echo json_encode(array(
				'code' => 'UNKNOWN_ERR',
				'data' => __('Errors occurred:','udmupdater').' '.htmlspecialchars(serialize($result))
			));
		}
	}
}
endif;
