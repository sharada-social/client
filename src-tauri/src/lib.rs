#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[allow(unused_mut)]
  let mut builder = tauri::Builder::default();

  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      use tauri::Manager;
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
      }
    }));
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(desktop)]
      {
        use tauri::Manager;
        use tauri::menu::{Menu, MenuItem};
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

        let quit_i = MenuItem::with_id(app, "quit", "Выйти из sharada", true, None::<&str>)?;
        let show_i = MenuItem::with_id(app, "show", "Открыть", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

        let _tray = TrayIconBuilder::with_id("main_tray")
          .icon(app.default_window_icon().unwrap().clone())
          .menu(&menu)
          .show_menu_on_left_click(false)
          .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
              app.exit(0);
            }
            "show" => {
              if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
              }
            }
            _ => {}
          })
          .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
              button: MouseButton::Left,
              button_state: MouseButtonState::Up,
              ..
            } = event {
              let app = tray.app_handle();
              if let Some(win) = app.get_webview_window("main") {
                let is_minimized = win.is_minimized().unwrap_or(false);
                let is_visible = win.is_visible().unwrap_or(false);
                if is_visible && !is_minimized {
                  let _ = win.hide();
                } else {
                  let _ = win.unminimize();
                  let _ = win.show();
                  let _ = win.set_focus();
                }
              }
            }
          })
          .build(app)?;
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      #[cfg(desktop)]
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
